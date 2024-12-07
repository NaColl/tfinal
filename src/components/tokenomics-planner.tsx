"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Slider } from "./ui/slider";

import { Input } from "./ui/input";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Info, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

interface DistributionData {
  percentage: number;
  tge: number;
  duration: number;
}

interface Distribution {
  [key: string]: DistributionData;
}

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEEAD",
  "#D4A5A5",
  "#9B59B6",
];

const chartConfig = {
  publicSale: { label: "Public Sale", color: COLORS[0] },
  privateRounds: { label: "Private Rounds", color: COLORS[1] },
  teamAndAdvisors: { label: "Team And Advisors", color: COLORS[2] },
  development: { label: "Development", color: COLORS[3] },
  ecosystem: { label: "Ecosystem", color: COLORS[4] },
  treasury: { label: "Treasury", color: COLORS[5] },
  liquidityPool: { label: "Liquidity Pool", color: COLORS[6] },
} satisfies ChartConfig;

const TokenomicsPlanner = () => {
  const [totalSupply, setTotalSupply] = useState(1000000000);
  const [initialTokenPrice, setInitialTokenPrice] = useState(0.001);
  const [fdv, setFdv] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const [distribution, setDistribution] = useState<Distribution>({
    publicSale: { percentage: 20, tge: 10, duration: 12 },
    privateRounds: { percentage: 15, tge: 5, duration: 24 },
    teamAndAdvisors: { percentage: 15, tge: 0, duration: 36 },
    development: { percentage: 20, tge: 0, duration: 48 },
    ecosystem: { percentage: 15, tge: 5, duration: 36 },
    treasury: { percentage: 10, tge: 0, duration: 48 },
    liquidityPool: { percentage: 5, tge: 20, duration: 24 },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const newFdv = Math.max(0, totalSupply * initialTokenPrice);
    setFdv(newFdv);
  }, [totalSupply, initialTokenPrice]);

  const totalPercentage = Object.values(distribution).reduce(
    (sum, data) => sum + data.percentage,
    0,
  );

  const generateUnlockSchedule = () => {
    const months = 48;
    const schedule = Array.from({ length: months + 1 }, (_, month) => ({
      month,
      circulating: 0,
      rawCirculating: 0,
    }));

    Object.entries(distribution).forEach(([category, data]) => {
      const tokenAmount = Math.floor((totalSupply * data.percentage) / 100);
      const tgeAmount = Math.floor((tokenAmount * data.tge) / 100);
      const remainingAmount = tokenAmount - tgeAmount;

      const monthlyUnlock =
        data.duration > 0 ? remainingAmount / data.duration : 0;

      schedule[0].rawCirculating += tgeAmount;

      if (data.duration > 0) {
        for (let month = 1; month <= data.duration; month++) {
          schedule[month].rawCirculating += monthlyUnlock;
        }
      }
    });

    let cumulative = 0;
    return schedule.map((point) => {
      cumulative += point.rawCirculating;
      const actualCirculating = Math.min(cumulative, totalSupply);
      return {
        month: point.month,
        circulating: actualCirculating,
        percentCirculating: (actualCirculating / totalSupply) * 100,
      };
    });
  };

  const calculateMetrics = () => {
    const unlockSchedule = generateUnlockSchedule();
    const tgeCirculating = unlockSchedule[0].circulating;
    const tgeCirculatingPercent = (tgeCirculating / totalSupply) * 100;

    return {
      tgeCirculating,
      tgeCirculatingPercent,
      initialMarketCap: tgeCirculating * initialTokenPrice,
      fdvToMcapRatio:
        tgeCirculating > 0
          ? fdv / (tgeCirculating * initialTokenPrice)
          : Number.POSITIVE_INFINITY,
      warnings: [
        tgeCirculatingPercent > 25 &&
          "High TGE unlock may cause price instability",
        tgeCirculating > 0 &&
          fdv / (tgeCirculating * initialTokenPrice) > 100 &&
          "High FDV/MCap ratio indicates significant future dilution",
        distribution.teamAndAdvisors.percentage > 20 &&
          "Team allocation appears high",
        distribution.liquidityPool.percentage < 5 &&
          "Low liquidity allocation may cause price volatility",
      ].filter(Boolean),
    };
  };

  const handleDistributionChange = (
    category: string,
    field: keyof DistributionData,
    value: number,
  ) => {
    const numValue = Math.max(0, Number(value));

    if (field === "percentage") {
      // Calculate the total percentage without the current category
      const otherCategories = Object.entries(distribution).filter(
        ([cat]) => cat !== category,
      );

      const otherTotal = otherCategories.reduce(
        (sum, [_, data]) => sum + data.percentage,
        0,
      );

      // Calculate how much we need to adjust other categories
      const currentValue = distribution[category].percentage;

      if (otherTotal + numValue <= 100) {
        // If we're not exceeding 100%, just update the current category
        setDistribution((prev) => ({
          ...prev,
          [category]: {
            ...prev[category],
            percentage: Math.round(numValue * 10) / 10,
          },
        }));
      } else {
        // If we would exceed 100%, adjust other categories proportionally
        const scale = (100 - numValue) / otherTotal;

        let newDistribution = Object.entries(distribution).reduce(
          (acc, [cat, data]) => {
            if (cat === category) {
              acc[cat] = {
                ...data,
                percentage: Math.round(numValue * 10) / 10,
              };
            } else {
              // Round to 1 decimal place
              let scaledPercentage =
                Math.round(data.percentage * scale * 10) / 10;
              acc[cat] = { ...data, percentage: scaledPercentage };
            }
            return acc;
          },
          {} as Distribution,
        );

        // Ensure total is exactly 100%
        const newTotal = Object.values(newDistribution).reduce(
          (sum, data) => sum + data.percentage,
          0,
        );
        if (newTotal !== 100) {
          // Adjust the largest allocation slightly to make total exactly 100%
          const largestCategory = Object.entries(newDistribution)
            .filter(([cat]) => cat !== category)
            .reduce((max, curr) =>
              curr[1].percentage > max[1].percentage ? curr : max,
            );

          if (largestCategory[0]) {
            newDistribution[largestCategory[0]].percentage +=
              Math.round((100 - newTotal) * 10) / 10;
          }
        }

        setDistribution(newDistribution);
      }
    } else if (field === "tge") {
      setDistribution((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [field]: Math.min(100, Math.max(0, Math.round(numValue * 10) / 10)),
        },
      }));
    } else if (field === "duration") {
      setDistribution((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          [field]: Math.max(0, Math.round(numValue)),
        },
      }));
    }
  };

  const handleTotalSupplyChange = (value: number) => {
    setTotalSupply(Math.max(1, value));
  };

  const handleTokenPriceChange = (value: number) => {
    setInitialTokenPrice(Math.max(0, value));
  };

  const metrics = calculateMetrics();
  const unlockSchedule = generateUnlockSchedule();

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6 bg-[#14101b] text-white">
      <Card className="bg-[#1c1525] border-[#ffffff1a]">
        <CardHeader className="border-b border-[#ffffff1a]">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              Advanced Tokenomics Planner
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex flex-col items-end gap-3">
              <img
                src="/collector-logo.png"
                alt="The Collector Logo"
                className="w-24 h-24 object-contain"
              />
              <div className="text-sm text-gray-400">
                Built by The Naked Collector
              </div>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Total Supply
                  </label>
                  <Input
                    type="number"
                    value={totalSupply}
                    onChange={(e) =>
                      handleTotalSupplyChange(Number(e.target.value))
                    }
                    min="1"
                    className="bg-[#2a2333] border-[#ffffff1a] text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Initial Token Price ($)
                  </label>
                  <Input
                    type="number"
                    value={initialTokenPrice}
                    onChange={(e) =>
                      handleTokenPriceChange(Number(e.target.value))
                    }
                    min="0"
                    step="0.000001"
                    className="bg-[#2a2333] border-[#ffffff1a] text-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-[#2a2333] p-4 rounded-lg">
                <div>
                  <div className="text-sm text-gray-400">
                    Initial Market Cap
                  </div>
                  <div className="text-lg font-medium text-white">
                    $
                    {metrics.initialMarketCap.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">
                    Fully Diluted Value
                  </div>
                  <div className="text-lg font-medium text-white">
                    $
                    {fdv.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">TGE Circulating</div>
                  <div className="text-lg font-medium text-white">
                    {metrics.tgeCirculatingPercent.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">FDV/MCap Ratio</div>
                  <div className="text-lg font-medium text-white">
                    {Number.isFinite(metrics.fdvToMcapRatio)
                      ? metrics.fdvToMcapRatio.toFixed(1)
                      : "∞"}
                    x
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#2a2333]">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-white">
                    Total Allocation
                  </span>
                  <span
                    className={`text-lg font-medium ${
                      totalPercentage > 100 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {totalPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-[#14101b] h-2 rounded-full mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      totalPercentage > 100 ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(distribution).map(([category, data]) => (
                  <div
                    key={category}
                    className="space-y-2 border border-[#ffffff1a] rounded-lg p-4 bg-[#2a2333]"
                  >
                    <div
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() =>
                        setExpandedCategory(
                          expandedCategory === category ? null : category,
                        )
                      }
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-white">
                          {category
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (str) => str.toUpperCase())}
                        </div>
                        <div className="text-sm text-gray-300">
                          {data.percentage.toFixed(1)}% (
                          {Math.floor(
                            (totalSupply * data.percentage) / 100,
                          ).toLocaleString()}{" "}
                          tokens)
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-400 hover:text-white"
                      >
                        {expandedCategory === category ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-xs text-gray-300 mb-2">
                          Drag the slider to adjust the percentage allocation
                          for this category
                        </div>
                        <Slider
                          value={[data.percentage]}
                          onValueChange={(newValue) =>
                            handleDistributionChange(
                              category,
                              "percentage",
                              newValue[0],
                            )
                          }
                          max={100}
                          step={0.1}
                          className={`
                            ${totalPercentage > 100 ? "opacity-50" : ""} 
                            [&_[role=slider]]:bg-white 
                            [&_[role=slider]]:border-white 
                            [&_[role=slider]]:hover:bg-white/90
                            [&_[role=slider]]:w-4 
                            [&_[role=slider]]:h-4
                            [&_[role=track]]:!bg-white 
                            [&_[role=range]]:!bg-white
                            [&_[role=track]]:border-0
                          `}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          value={data.percentage}
                          onChange={(e) =>
                            handleDistributionChange(
                              category,
                              "percentage",
                              Number(e.target.value),
                            )
                          }
                          className="bg-[#2a2333] border-[#ffffff1a] text-white text-right"
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                    </div>

                    {expandedCategory === category && (
                      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#ffffff1a]">
                        <div>
                          <label className="text-sm text-gray-300">
                            TGE Unlock %
                          </label>
                          <Input
                            type="number"
                            value={data.tge}
                            onChange={(e) =>
                              handleDistributionChange(
                                category,
                                "tge",

                                Number(e.target.value),
                              )
                            }
                            className="mt-1 bg-[#2a2333] border-[#ffffff1a] text-white"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-300">
                            Vesting Duration (months)
                          </label>
                          <Input
                            type="number"
                            value={data.duration}
                            onChange={(e) =>
                              handleDistributionChange(
                                category,
                                "duration",
                                Number(e.target.value),
                              )
                            }
                            className="mt-1 bg-[#2a2333] border-[#ffffff1a] text-white"
                            min="0"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {metrics.warnings.length > 0 && (
                <div className="space-y-2">
                  {metrics.warnings.map((warning, idx) => (
                    <Alert
                      key={idx}
                      variant="destructive"
                      className="bg-red-900/50 border-red-700"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-white">Warning</AlertTitle>
                      <AlertDescription className="text-gray-200">
                        {warning}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column - Charts */}
            <div className="space-y-8">
              {isClient && (
                <>
                  <ChartContainer config={chartConfig}>
                    <div>
                      <h3 className="text-sm font-medium mb-4 text-white">
                        Token Distribution
                      </h3>
                      <div className="flex flex-col items-center">
                        <PieChart width={500} height={350}>
                          <Pie
                            data={Object.entries(distribution).map(
                              ([name, data]) => ({
                                name: chartConfig[
                                  name as keyof typeof chartConfig
                                ].label,
                                value: data.percentage,
                              }),
                            )}
                            cx={220}
                            cy={175}
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={2}
                            dataKey="value"
                            label={false}
                            labelLine={false}
                          >
                            {Object.entries(distribution).map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                className="opacity-90 hover:opacity-100 transition-opacity"
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ payload }) => {
                              if (payload && payload[0]) {
                                return (
                                  <div className="bg-white rounded-lg p-2 shadow-lg border border-gray-100">
                                    <div className="text-[#14101b] font-medium">
                                      {payload[0].name}:{" "}
                                      {payload[0].value.toFixed(1)}%
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                            iconSize={8}
                            wrapperStyle={{
                              paddingLeft: "30px",
                              fontSize: "11px",
                              lineHeight: "20px",
                              color: "rgba(255, 255, 255, 0.8)",
                            }}
                            formatter={(value) => value}
                          />
                        </PieChart>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium mb-4 text-white">
                        Token Unlock Schedule
                      </h3>
                      <div className="text-sm text-gray-400 mb-4">
                        Shows cumulative circulating supply percentage over time
                      </div>
                      <div className="flex flex-col items-center">
                        <LineChart
                          width={500}
                          height={350}
                          data={unlockSchedule}
                          margin={{ top: 20, right: 40, left: 40, bottom: 40 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            strokeOpacity={0.1}
                            stroke="rgba(255, 255, 255, 0.2)"
                          />
                          <XAxis
                            dataKey="month"
                            label={{
                              value: "Months after TGE",
                              position: "bottom",
                              offset: 20,
                              style: {
                                fontSize: 11,
                                fill: "rgba(255, 255, 255, 0.7)",
                              },
                            }}
                            tick={{
                              fontSize: 11,
                              fill: "rgba(255, 255, 255, 0.7)",
                            }}
                            axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                            tickLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                          />
                          <YAxis
                            label={{
                              value: "Circulating Supply %",
                              angle: -90,
                              position: "insideLeft",
                              offset: 0,
                              style: {
                                fontSize: 11,
                                fill: "rgba(255, 255, 255, 0.7)",
                                textAnchor: "middle",
                              },
                            }}
                            domain={[0, 100]}
                            ticks={[0, 20, 40, 60, 80, 100]}
                            tickFormatter={(value) => `${value}%`}
                            tick={{
                              fontSize: 11,
                              fill: "rgba(255, 255, 255, 0.7)",
                            }}
                            axisLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                            tickLine={{ stroke: "rgba(255, 255, 255, 0.1)" }}
                          />
                          <Tooltip
                            content={({ payload, label }) => {
                              if (payload && payload[0]) {
                                return (
                                  <div className="bg-white rounded-lg p-2 shadow-lg border border-gray-100">
                                    <div className="text-[#14101b] font-medium">
                                      Month {label}:{" "}
                                      {payload[0].value.toFixed(2)}%
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="percentCirculating"
                            stroke="white"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, fill: "white" }}
                          />
                        </LineChart>

                        <div className="text-xs text-gray-400 mt-6 w-full px-4">
                          <div className="font-medium mb-2">Key Points:</div>
                          <ul className="list-disc ml-4 space-y-1">
                            <li>
                              TGE Release:{" "}
                              {metrics.tgeCirculatingPercent.toFixed(1)}%
                            </li>
                            <li>
                              Initial Market Cap: $
                              {metrics.initialMarketCap.toLocaleString(
                                undefined,
                                {
                                  maximumFractionDigits: 0,
                                },
                              )}
                            </li>
                            <li>
                              Final FDV: $
                              {fdv.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                              })}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </ChartContainer>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TokenomicsPlanner;

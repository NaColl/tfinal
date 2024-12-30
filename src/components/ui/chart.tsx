import { TooltipProps } from "recharts/types/component/Tooltip"

export interface ChartConfig {
  [key: string]: {
    label: string
    color?: string
  }
}

export function ChartContainer({
  children,
  config,
  className,
}: {
  children: React.ReactNode
  config: ChartConfig
  className?: string
}) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export const ChartTooltip: React.FC<TooltipProps<any, any> & { children?: React.ReactNode }> = (props) => {
  const { content, children, ...divProps } = props;
  const tooltipContent = typeof content === 'function' ? content(props) : content;

  return (
    <div className="rounded-lg border border-gray-300 bg-gray-100 p-4 shadow-lg text-gray-800" {...divProps}>
      {tooltipContent || children}
    </div>
  );
}
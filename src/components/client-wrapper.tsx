'use client'

import dynamic from 'next/dynamic'

const TokenomicsPlanner = dynamic(() => import('./tokenomics-planner'), {
  ssr: false
})

export function ClientWrapper() {
  return <TokenomicsPlanner />
}
'use client'

import { useEffect, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { escrowAbi } from '@/lib/abi'
import { Connect } from '@/components/connect'
import { DealList } from '@/components/deal-list'
import { OpenDeal } from '@/components/open-deal'
import { WalletCard } from '@/components/wallet-card'
import { ESCROW, chain, explorerAddress, isLocal } from '@/lib/config'
import { same, short } from '@/lib/deals'

const steps = [
  ['Buyer pays in', 'Stablecoin moves into the contract, not to the seller.'],
  ['Seller delivers', 'Marks the order delivered before the deadline.'],
  ['Buyer inspects', 'Releases, or disputes within the window.'],
  ['Everyone withdraws', 'Each side pulls out what they’re owed.'],
]

export default function Home() {
  const { address, isConnected } = useAccount()
  const { data: arbiter } = useReadContract({ address: ESCROW, abi: escrowAbi, functionName: 'arbiter' })
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const contractUrl = explorerAddress(ESCROW)

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Escrow</h1>
          <p className="text-sm text-zinc-500">
            <span className={`mr-1.5 inline-block size-2 rounded-full ${isLocal ? 'bg-amber-400' : 'bg-emerald-500'}`} />
            {isLocal ? 'Local test chain' : chain.name} · contract{' '}
            {contractUrl ? (
              <a href={contractUrl} target="_blank" rel="noreferrer" className="font-mono underline">
                {short(ESCROW)}
              </a>
            ) : (
              <span className="font-mono">{short(ESCROW)}</span>
            )}
          </p>
        </div>
        {mounted && <Connect />}
      </header>

      <ol className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {steps.map(([title, body], i) => (
          <li key={title} className="rounded-xl border border-zinc-200 bg-white p-4">
            <span className="text-xs font-medium text-zinc-400">0{i + 1}</span>
            <p className="mt-1 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{body}</p>
          </li>
        ))}
      </ol>

      {mounted &&
        (isConnected ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="min-w-0 space-y-6">
              <WalletCard />
              {!same(address, arbiter) && <OpenDeal />}
            </div>
            <div className="min-w-0">
              <DealList />
            </div>
          </div>
        ) : (
          <div className="card mt-8 text-center">
            <p className="font-medium">Connect to start</p>
            <p className="mt-1 text-sm text-zinc-500">
              {isLocal
                ? 'Pick Buyer, Seller or Arbiter above to act as that person on the local chain.'
                : 'Connect a wallet on Base Sepolia to open or manage a deal.'}
            </p>
          </div>
        ))}

      <p className="mt-10 text-center text-xs text-zinc-400">
        Unaudited demo. Test money only.
      </p>
    </main>
  )
}

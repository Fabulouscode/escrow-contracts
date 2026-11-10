'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { escrowAbi } from '@/lib/abi'
import { ESCROW } from '@/lib/config'
import { same, type Deal } from '@/lib/deals'
import { DealCard } from './deal-card'

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function DealList() {
  const { address } = useAccount()
  const now = useNow()
  const [all, setAll] = useState(false)

  const { data: nextId = 1n } = useReadContract({ address: ESCROW, abi: escrowAbi, functionName: 'nextId' })
  const { data: arbiter } = useReadContract({ address: ESCROW, abi: escrowAbi, functionName: 'arbiter' })

  const ids = useMemo(() => {
    const list: bigint[] = []
    for (let i = nextId - 1n; i >= 1n; i--) list.push(i)
    return list
  }, [nextId])

  const { data } = useReadContracts({
    contracts: ids.map((id) => ({ address: ESCROW, abi: escrowAbi, functionName: 'deals', args: [id] }) as const),
  })

  const isArbiter = same(address, arbiter)
  const deals: Deal[] = (data ?? []).flatMap((r, i) => {
    if (r.status !== 'success') return []
    const [buyer, seller, token, amount, deliverBy, inspectUntil, status] = r.result
    return [{ id: ids[i], buyer, seller, token, amount, deliverBy: Number(deliverBy), inspectUntil: Number(inspectUntil), status }]
  })
  const shown = all || isArbiter ? deals : deals.filter((d) => same(d.buyer, address) || same(d.seller, address))

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {isArbiter ? 'All deals (you are the arbiter)' : all ? 'All deals' : 'Your deals'}
        </h2>
        {!isArbiter && (
          <button className="text-xs text-zinc-500 underline" onClick={() => setAll(!all)}>
            {all ? 'Show only mine' : 'Show everyone’s'}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card text-center text-sm text-zinc-500">
          No deals yet. {isArbiter ? 'They’ll show here when buyers open them.' : 'Open one on the left.'}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((d) => (
            <DealCard key={d.id.toString()} deal={d} me={address} isArbiter={isArbiter} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}

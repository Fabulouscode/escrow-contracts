'use client'

import { useState } from 'react'
import { formatUnits, type Address } from 'viem'
import { escrowAbi } from '@/lib/abi'
import { DECIMALS, ESCROW, SYMBOL, demoAccounts, explorerAddress, isLocal } from '@/lib/config'
import { Status, money, relative, same, short, statusLabel, toUnits, type Deal } from '@/lib/deals'
import { useTx } from '@/lib/use-tx'
import { TxNote } from './tx-note'

type Action = { key: string; label: string; fn: 'markDelivered' | 'release' | 'claim' | 'refundExpired' | 'refund' | 'dispute'; tone?: 'primary' | 'danger' }

function actionsFor(d: Deal, me: Address | undefined, now: number): Action[] {
  const buyer = same(me, d.buyer)
  const seller = same(me, d.seller)
  const list: Action[] = []

  if (buyer) {
    if (d.status === Status.Funded || d.status === Status.Delivered)
      list.push({ key: 'release', label: 'Release to seller', fn: 'release', tone: 'primary' })
    if (d.status === Status.Delivered && now <= d.inspectUntil)
      list.push({ key: 'dispute', label: 'Raise a dispute', fn: 'dispute', tone: 'danger' })
    if (d.status === Status.Funded && now > d.deliverBy)
      list.push({ key: 'refundExpired', label: 'Take my money back', fn: 'refundExpired' })
  }
  if (seller) {
    if (d.status === Status.Funded && now <= d.deliverBy)
      list.push({ key: 'deliver', label: 'Mark as delivered', fn: 'markDelivered', tone: 'primary' })
    if (d.status === Status.Delivered && now > d.inspectUntil)
      list.push({ key: 'claim', label: 'Claim payment', fn: 'claim', tone: 'primary' })
    if (d.status === Status.Funded || d.status === Status.Delivered || d.status === Status.Disputed)
      list.push({ key: 'refund', label: 'Refund the buyer', fn: 'refund' })
  }
  return list
}

function hint(d: Deal, now: number) {
  if (d.status === Status.Funded)
    return now <= d.deliverBy
      ? `Seller must deliver ${relative(d.deliverBy, now)}`
      : `Delivery deadline passed ${relative(d.deliverBy, now)}; the buyer can take the money back`
  if (d.status === Status.Delivered)
    return now <= d.inspectUntil
      ? `Buyer can inspect and dispute until ${relative(d.inspectUntil, now)}`
      : 'Inspection is over with no dispute; the seller can claim'
  if (d.status === Status.Disputed) return 'Waiting for the arbiter to decide'
  return null
}

function Party({ label, address, me }: { label: string; address: string; me?: string }) {
  const url = explorerAddress(address)
  const text = short(address)
  const demo = demoAccounts.find((a) => same(a.address, address))
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
            {text}
          </a>
        ) : (
          text
        )}
        {same(address, me) ? (
          <span className="ml-1.5 font-sans text-xs text-zinc-500">(you)</span>
        ) : (
          isLocal && demo && <span className="ml-1.5 font-sans text-xs text-zinc-500">({demo.role})</span>
        )}
      </dd>
    </div>
  )
}

export function DealCard({ deal, me, isArbiter, now }: { deal: Deal; me?: Address; isArbiter: boolean; now: number }) {
  const { send, busy, error, lastHash } = useTx()
  const [toSeller, setToSeller] = useState(formatUnits(deal.amount / 2n, DECIMALS))
  const status = statusLabel[deal.status]
  const actions = actionsFor(deal, me, now)
  const split = toUnits(toSeller) ?? 0n
  const note = hint(deal, now)

  const run = (a: Action) =>
    send(a.key, { address: ESCROW, abi: escrowAbi, functionName: a.fn, args: [deal.id] })

  return (
    <article className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500">Deal #{deal.id.toString()}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{money(deal.amount)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${status.tone}`}>{status.text}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <Party label="Buyer" address={deal.buyer} me={me} />
        <Party label="Seller" address={deal.seller} me={me} />
      </dl>

      {note && <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">{note}</p>}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.key}
              disabled={!!busy}
              onClick={() => run(a)}
              className={a.tone === 'primary' ? 'btn-primary' : a.tone === 'danger' ? 'btn-danger' : 'btn-ghost'}
            >
              {busy === a.key ? 'Confirming…' : a.label}
            </button>
          ))}
        </div>
      )}

      {isArbiter && deal.status === Status.Disputed && (
        <div className="mt-4 rounded-lg border border-zinc-200 p-3">
          <label className="label" htmlFor={`split-${deal.id}`}>
            Pay the seller ({SYMBOL}); the rest goes back to the buyer
          </label>
          <div className="flex gap-2">
            <input
              id={`split-${deal.id}`}
              className="input tabular-nums"
              inputMode="decimal"
              value={toSeller}
              onChange={(e) => setToSeller(e.target.value)}
            />
            <button
              className="btn-primary shrink-0"
              disabled={!!busy || split > deal.amount}
              onClick={() =>
                send('resolve', {
                  address: ESCROW,
                  abi: escrowAbi,
                  functionName: 'resolve',
                  args: [deal.id, split],
                })
              }
            >
              {busy === 'resolve' ? 'Confirming…' : 'Settle'}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Seller gets {money(split > deal.amount ? deal.amount : split)}, buyer gets{' '}
            {money(split > deal.amount ? 0n : deal.amount - split)}
          </p>
        </div>
      )}

      <TxNote error={error} hash={lastHash} />
    </article>
  )
}

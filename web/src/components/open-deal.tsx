'use client'

import { useState } from 'react'
import { isAddress, type Address } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { escrowAbi } from '@/lib/abi'
import { ESCROW, SYMBOL, TOKEN, demoAccounts, isLocal, tokenAbi } from '@/lib/config'
import { same, toUnits } from '@/lib/deals'
import { useTx } from '@/lib/use-tx'
import { TxNote } from './tx-note'

const windows = [
  { label: '5 minutes', seconds: 300 },
  { label: '1 hour', seconds: 3600 },
  { label: '1 day', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
]

export function OpenDeal() {
  const { address } = useAccount()
  const { send, busy, error, lastHash } = useTx()
  const [seller, setSeller] = useState('')
  const [amount, setAmount] = useState('')
  const [within, setWithin] = useState(windows[0].seconds)

  const { data: allowance = 0n } = useReadContract({
    address: TOKEN,
    abi: tokenAbi,
    functionName: 'allowance',
    args: [address!, ESCROW],
    query: { enabled: !!address },
  })

  const units = toUnits(amount)
  const problem = !isAddress(seller)
    ? 'Enter the seller’s wallet address'
    : same(seller, address)
      ? 'You can’t sell to yourself'
      : !units
        ? 'Enter an amount'
        : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (problem || !units) return
    const deliverBy = BigInt(Math.floor(Date.now() / 1000) + within)
    const open = {
      address: ESCROW,
      abi: escrowAbi,
      functionName: 'open',
      args: [seller as Address, TOKEN, units, deliverBy],
    } as const
    const ok =
      allowance >= units
        ? await send('open', open)
        : await send(
            'open',
            { address: TOKEN, abi: tokenAbi, functionName: 'approve', args: [ESCROW, units] },
            open,
          )
    if (ok) setAmount('')
  }

  const demoSeller = demoAccounts.find((a) => a.role === 'Seller')!.address

  return (
    <form onSubmit={submit} className="card">
      <h2 className="text-sm font-semibold">Pay into escrow</h2>
      <p className="mt-1 text-sm text-zinc-500">
        The contract holds your {SYMBOL} until you confirm the delivery.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="label" htmlFor="seller">
            Seller’s wallet
          </label>
          <input
            id="seller"
            className="input font-mono"
            placeholder="0x…"
            value={seller}
            onChange={(e) => setSeller(e.target.value.trim())}
          />
          {isLocal && !same(address, demoSeller) && (
            <button type="button" className="mt-1.5 text-xs text-zinc-500 underline" onClick={() => setSeller(demoSeller)}>
              Use the demo seller
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="amount">
              Amount ({SYMBOL})
            </label>
            <input
              id="amount"
              className="input tabular-nums"
              inputMode="decimal"
              placeholder="250"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="within">
              Seller must deliver within
            </label>
            <select id="within" className="input" value={within} onChange={(e) => setWithin(Number(e.target.value))}>
              {windows.map((w) => (
                <option key={w.seconds} value={w.seconds}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button className="btn-primary mt-4 w-full" disabled={!!problem || !!busy}>
        {busy ? 'Confirming…' : units && allowance < units ? 'Approve and pay' : 'Pay into escrow'}
      </button>
      {problem && seller !== '' && amount !== '' && <p className="mt-2 text-xs text-zinc-500">{problem}</p>}
      <TxNote error={error} hash={lastHash} />
    </form>
  )
}

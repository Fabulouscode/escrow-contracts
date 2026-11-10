'use client'

import { parseUnits } from 'viem'
import { useAccount, useReadContracts } from 'wagmi'
import { escrowAbi } from '@/lib/abi'
import { DECIMALS, ESCROW, SYMBOL, TOKEN, isLocal, tokenAbi } from '@/lib/config'
import { money } from '@/lib/deals'
import { useTx } from '@/lib/use-tx'
import { TxNote } from './tx-note'

export function WalletCard() {
  const { address } = useAccount()
  const { send, busy, error, lastHash } = useTx()
  const { data } = useReadContracts({
    contracts: [
      { address: TOKEN, abi: tokenAbi, functionName: 'balanceOf', args: [address!] },
      { address: ESCROW, abi: escrowAbi, functionName: 'owed', args: [address!, TOKEN] },
    ],
    query: { enabled: !!address },
  })
  const balance = data?.[0].result ?? 0n
  const owed = data?.[1].result ?? 0n

  return (
    <section className="card">
      <h2 className="text-sm font-semibold">Your money</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-zinc-50 p-3">
          <dt className="text-xs text-zinc-500">In your wallet</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{money(balance)}</dd>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <dt className="text-xs text-zinc-500">Ready to withdraw</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{money(owed)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={owed === 0n || !!busy}
          onClick={() =>
            send('withdraw', { address: ESCROW, abi: escrowAbi, functionName: 'withdraw', args: [TOKEN] })
          }
        >
          {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw'}
        </button>
        {isLocal && (
          <button
            className="btn-ghost"
            disabled={!!busy}
            onClick={() =>
              send('mint', {
                address: TOKEN,
                abi: tokenAbi,
                functionName: 'mint',
                args: [address!, parseUnits('1000', DECIMALS)],
              })
            }
          >
            {busy === 'mint' ? 'Minting…' : `Get 1,000 test ${SYMBOL}`}
          </button>
        )}
      </div>
      <TxNote error={error} hash={lastHash} />
    </section>
  )
}

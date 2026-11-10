'use client'

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { chain, isLocal } from '@/lib/config'
import { short } from '@/lib/deals'

export function Connect() {
  const { address, connector, chainId, isConnected } = useAccount()
  const { connectors, connectAsync, isPending } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const demo = connectors.filter((c) => c.id.startsWith('demo-'))
  const wallet = connectors.find((c) => c.id === 'injected')

  async function use(target: (typeof connectors)[number]) {
    if (isConnected) await disconnectAsync()
    await connectAsync({ connector: target })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isLocal && (
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1">
          <span className="px-2 text-xs text-zinc-500">Act as</span>
          {demo.map((c) => (
            <button
              key={c.uid}
              disabled={isPending}
              onClick={() => use(c)}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
                connector?.id === c.id ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {isConnected && connector?.id === 'injected' && chainId !== chain.id && (
        <button className="btn-danger" onClick={() => switchChain({ chainId: chain.id })}>
          Switch to {chain.name}
        </button>
      )}

      {isConnected && !connector?.id.startsWith('demo-') ? (
        <button className="btn-ghost font-mono" onClick={() => disconnectAsync()} title="Disconnect">
          {short(address!)}
        </button>
      ) : (
        wallet && (
          <button className={isLocal ? 'btn-ghost' : 'btn-primary'} disabled={isPending} onClick={() => use(wallet)}>
            {isLocal ? 'Browser wallet' : 'Connect wallet'}
          </button>
        )
      )}
    </div>
  )
}

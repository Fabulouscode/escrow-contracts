import { explorerTx } from '@/lib/config'

export function TxNote({ error, hash }: { error: string | null; hash: string | null }) {
  if (error) return <p className="mt-3 text-sm text-rose-700">{error}</p>
  if (!hash) return null
  const url = explorerTx(hash)
  return (
    <p className="mt-3 truncate font-mono text-xs text-zinc-500">
      Last tx{' '}
      {url ? (
        <a className="underline hover:text-zinc-900" href={url} target="_blank" rel="noreferrer">
          {hash}
        </a>
      ) : (
        hash
      )}
    </p>
  )
}

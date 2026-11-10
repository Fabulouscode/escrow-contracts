'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePublicClient, useWriteContract } from 'wagmi'
import { BaseError, type Abi, type Address } from 'viem'

type Write = { address: Address; abi: Abi; functionName: string; args?: readonly unknown[] }

export function useTx() {
  const { writeContractAsync } = useWriteContract()
  const client = usePublicClient()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastHash, setLastHash] = useState<string | null>(null)

  async function send(label: string, ...steps: Write[]) {
    setBusy(label)
    setError(null)
    try {
      for (const step of steps) {
        const hash = await writeContractAsync(step as never)
        setLastHash(hash)
        await client!.waitForTransactionReceipt({ hash })
      }
      await queryClient.invalidateQueries()
      return true
    } catch (e) {
      setError(e instanceof BaseError ? e.shortMessage : (e as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  return { send, busy, error, lastHash }
}

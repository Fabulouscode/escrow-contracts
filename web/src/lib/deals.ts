import { formatUnits, parseUnits, type Address } from 'viem'
import { DECIMALS, SYMBOL } from './config'

export const Status = {
  None: 0,
  Funded: 1,
  Delivered: 2,
  Disputed: 3,
  Released: 4,
  Refunded: 5,
  Resolved: 6,
} as const

export const statusLabel: Record<number, { text: string; tone: string }> = {
  1: { text: 'Awaiting delivery', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  2: { text: 'In inspection', tone: 'bg-sky-50 text-sky-800 ring-sky-200' },
  3: { text: 'Disputed', tone: 'bg-rose-50 text-rose-800 ring-rose-200' },
  4: { text: 'Paid to seller', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  5: { text: 'Refunded', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-200' },
  6: { text: 'Settled by arbiter', tone: 'bg-violet-50 text-violet-800 ring-violet-200' },
}

export type Deal = {
  id: bigint
  buyer: Address
  seller: Address
  token: Address
  amount: bigint
  deliverBy: number
  inspectUntil: number
  status: number
}

export const money = (amount: bigint) =>
  `${Number(formatUnits(amount, DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${SYMBOL}`

export const toUnits = (value: string) => {
  try {
    const n = parseUnits(value.trim() || '0', DECIMALS)
    return n > 0n ? n : null
  } catch {
    return null
  }
}

export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export function relative(seconds: number, now: number) {
  const diff = seconds - now
  const abs = Math.abs(diff)
  const unit =
    abs < 60 ? `${abs}s` : abs < 3600 ? `${Math.round(abs / 60)}m` : abs < 86400 ? `${Math.round(abs / 3600)}h` : `${Math.round(abs / 86400)}d`
  return diff >= 0 ? `in ${unit}` : `${unit} ago`
}

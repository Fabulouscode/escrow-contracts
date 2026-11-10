import { createConfig, createConnector, http, injected, mock } from 'wagmi'
import { baseSepolia, foundry } from 'wagmi/chains'
import { erc20Abi, type Address } from 'viem'

export const isLocal = process.env.NEXT_PUBLIC_NETWORK !== 'base-sepolia'
export const chain = isLocal ? foundry : baseSepolia

export const ESCROW = (process.env.NEXT_PUBLIC_ESCROW ??
  '0x5FbDB2315678afecb367f032d93F642f64180aa3') as Address
export const TOKEN = (process.env.NEXT_PUBLIC_TOKEN ??
  '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as Address
export const SYMBOL = isLocal ? 'dUSD' : 'USDC'
export const DECIMALS = 6

export const explorerTx = (hash: string) =>
  isLocal ? null : `https://sepolia.basescan.org/tx/${hash}`
export const explorerAddress = (address: string) =>
  isLocal ? null : `https://sepolia.basescan.org/address/${address}`

// Anvil's default dev accounts; it signs for them, so no wallet extension is needed locally.
export const demoAccounts = [
  { role: 'Buyer', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
  { role: 'Seller', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
  { role: 'Arbiter', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' },
] as const

const demoConnector = (role: string, address: Address) =>
  createConnector((config) => ({
    ...mock({ accounts: [address], features: { reconnect: true } })(config),
    id: `demo-${role.toLowerCase()}`,
    name: role,
  }))

export const tokenAbi = [
  ...erc20Abi,
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const config = createConfig({
  chains: [chain],
  connectors: isLocal
    ? [...demoAccounts.map((a) => demoConnector(a.role, a.address)), injected()]
    : [injected()],
  transports: { [chain.id]: http() } as Record<number, ReturnType<typeof http>>,
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

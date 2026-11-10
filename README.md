# Escrow contracts

A stablecoin (USDC/USDT) escrow on EVM chains. It follows the same deal flow as SafeDeal, but a contract holds the funds instead of a payment provider.

## How a deal moves

```
open (buyer pays in) ─▶ Funded ─▶ markDelivered (seller) ─▶ Delivered
   Funded    ── deadline passes, no delivery ─▶ refundExpired (buyer) ─▶ Refunded
   Delivered ── release (buyer) ─▶ Released
   Delivered ── inspection window passes in silence ─▶ claim (seller) ─▶ Released
   Delivered ── dispute (buyer, inside window) ─▶ Disputed ─▶ resolve (arbiter, any split) ─▶ Resolved
   seller can refund the buyer at any point before the money moves
```

Settling a deal credits `owed[account][token]`; each party then calls `withdraw(token)`.

## Run it

```sh
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge test -vv
```

## Watch it work locally

No faucet needed: Anvil runs a private chain with funded test accounts.

```sh
anvil                      # terminal 1
forge script script/Demo.s.sol:Demo --rpc-url http://127.0.0.1:8545 --broadcast   # terminal 2
```

It runs two deals (a straight sale, and a dispute the arbiter splits 180/120) and prints each step.

## Web app

`web/` is a Next.js + wagmi app where a buyer pays in, the seller marks delivery, the buyer releases or disputes, the arbiter settles and each side withdraws.

```sh
anvil                                                                                    # terminal 1
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://127.0.0.1:8545 --broadcast
cd web && npm install && npm run dev                                                     # http://localhost:3000
```

Locally, the **Act as Buyer / Seller / Arbiter** switch uses Anvil's built-in accounts, so no wallet extension is needed. For Base Sepolia, set the variables in `web/.env.example`; users then connect with MetaMask or Coinbase Wallet. After changing the contract, run `forge build && npm --prefix web run abi`.

## Deploy to a testnet (Base Sepolia)

```sh
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITER=0xYourArbiter forge script script/Deploy.s.sol --rpc-url base_sepolia --account dev --broadcast
```

`--account dev` uses an encrypted keystore: create one with `cast wallet new ~/.foundry/keystores dev` (or import an existing key with `cast wallet import dev --interactive`). Never put a private key in `.env` or in shell history.

## Known limits (this is a draft, not audited)

- **One trusted arbiter.** Whoever holds the arbiter key decides disputes. In production, use a multisig.
- **Pull payouts.** A blacklisted address can't withdraw its own share, but it no longer blocks the other party. Its credit stays in the contract.
- **Unsupported tokens.** Fee-on-transfer tokens are rejected, and rebasing tokens aren't supported.
- **No platform fee.** The contract takes no fee and has no upgrade path or pause switch.
- **Not ready for real money.** It needs an audit first, and a legal check (Nigeria SEC digital-asset rules) before it handles users' funds.

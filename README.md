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

## Run it

```sh
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge test -vv
```

## Deploy to a testnet (Base Sepolia)

```sh
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITER=0xYourArbiter forge script script/Deploy.s.sol --rpc-url base_sepolia --account dev --broadcast
```

`--account dev` uses a keystore made with `cast wallet import dev --interactive`. Never put a private key in `.env` or in shell history.

## Known limits (this is a draft, not audited)

- **One trusted arbiter.** Whoever holds the arbiter key decides disputes. In production, use a multisig.
- **Push payouts.** If USDC or USDT blacklists the recipient, the transfer reverts and the deal is stuck. Pull-based withdrawals would fix this.
- **Unsupported tokens.** Fee-on-transfer tokens are rejected, and rebasing tokens aren't supported.
- **No platform fee.** The contract takes no fee and has no upgrade path or pause switch.
- **Not ready for real money.** It needs an audit first, and a legal check (Nigeria SEC digital-asset rules) before it handles users' funds.

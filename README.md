# BalanceDue

A resumable invoice for buyers who hold funds in more than one wallet. Pay part, reopen the same link, and settle the remaining balance. The merchant sees one receipt with each confirmed payment.

Built for [NEAR Hackathon](https://nearhackathon.com/), Real-World Money. [Try the hosted app](https://balancedue.ajnasnb.workers.dev).

## Try it

1. Create a 100 USDC invoice in **USDC simulation**.
2. Start a 40 USDC payment and confirm it. Copy the invoice link and open it in another browser. It should show 60 USDC remaining.
3. Choose USDT on Ethereum and preview a live exact-output quote for the remaining balance. It quotes delivery of 60 USDC on Base. This dry run returns no deposit address.
4. Start the simulated payment. Refresh to see the pending attempt. Simulate a failure and verify the balance stays 60 USDC.
5. Start a fresh attempt for 60 USDC, confirm it, then reopen the link. It should show a single invoice receipt with two confirmed payments.

**[NEAR testnet receipt](https://balancedue.ajnasnb.workers.dev/?invoice=305b9d46-7f05-4982-adca-1532f1572c82)** shows two actual native testnet transfers from different wallets. [0.04 NEAR](https://testnet.nearblocks.io/txns/5hDmAZxi4BwLbxNn46zNaEGRtcJYjJ3D45222yDa6a7Y) and [0.06 NEAR](https://testnet.nearblocks.io/txns/3mmuBRsujVr1KqRfj6eZb4McnWwh7JHEQVuBSD31ihHa) settle a 0.10 NEAR invoice. Testnet tokens have no monetary value. The app verifies final success, sender, recipient, transfer amount and transaction time against testnet RPC.

## Run locally

Node.js 22 or later.

```sh
npm ci
npm test
npm run db:local
npm run dev
```

Run the browser regression against a running instance with `node scripts/browser-demo.mjs`. Set `DEMO_URL` for a different origin and `DEMO_CAPTURE=1` for screenshots and recordings. The browser script uses installed Chrome. `node scripts/testnet.mjs` creates disposable testnet accounts using the public faucet and exercises two genuine transfers. It holds their signing keys in memory only. No mainnet signing is supported.

## How it works

Cloudflare Workers serves the checkout and its API. D1 stores the invoice and attempts using integer amounts. A conditional SQL insert and a unique partial index prevent concurrent checkout attempts. Settlement updates only a pending attempt, and a database uniqueness constraint prevents reusing one testnet transaction across invoices.

NEAR Intents is the source for live exact-output previews. The prototype has three distinct modes of evidence: a USDC simulation with deterministic failure and retry, a real dry-run Intents quote, and verified native NEAR testnet transfers. Intents has no testnet. The prototype does not execute cross-chain mainnet payments or offer UPI, card or bank settlement. The link is the access credential in this demo. Use synthetic invoice details. Production needs merchant authentication, abuse controls, durable live payment monitoring and a policy for late or ambiguous settlements.

See [idea and competitor research](docs/idea.md) and [NEAR Intents documentation](https://docs.near-intents.org/).

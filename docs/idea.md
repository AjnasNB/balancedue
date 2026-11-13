# BalanceDue

Independent studios and merchants that already accept stablecoins can let customers finish paying a single invoice in multiple visits. The merchant gets one receipt with each settled payment. An unresolved payment holds its place so a refresh or wallet switch cannot create a second charge through the same checkout.

The product starts with one settlement currency and two quote routes. NEAR Intents provides an exact-output preview for the remaining balance. The prototype separates three environments: a repeatable stablecoin simulation, a live quote preview without a deposit address, and a real native-NEAR testnet receipt verifier.

Existing payment links are well established. NEAR Cross-Pay showcases PingPay, and PayBeam demonstrates cross-chain split invoices. BalanceDue focuses on what happens after a checkout is interrupted: keep confirmed money, show pending money, calculate the amount still owed, and generate one merchant receipt. RupeeRail and Tap2ETH show the value of using a familiar payment interaction.

Acceptance: create a 100 USDC invoice, settle 40 in demo mode, reopen it in a fresh browser, attempt 60, let one attempt fail, retry and settle 60, and replay the confirmation. Merchant and payer should see the same two confirmed entries and zero remaining.

Commercial hypothesis: agencies that already accept stablecoins may pay a subscription for invoice recovery and reconciliation exports. Measure how often partial or interrupted payments are completed without manual follow-up.

Sources: [NEAR Hackathon](https://nearhackathon.com/HACKATHON.md), [NEAR Cross-Pay](https://intents.near.org/use-cases/cross-pay), [PayBeam](https://github.com/payBeam/payBeam-ZETA), [RupeeRail](https://ethglobal.com/showcase/rupeerail-ygkws), [Tap2ETH](https://ethglobal.com/showcase/tap2eth-ck8gt).

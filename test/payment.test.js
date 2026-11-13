import { test } from "node:test";
import assert from "node:assert/strict";
import { createQuoteRequest, parseAmount, quoteView, verifyTransfer } from "../src/payment.js";

test("amounts use integer units and preserve six decimals", () => {
  assert.equal(parseAmount("40.000001"), 40000001);
  for (const value of [0, "0", "-1", "1e3", "1.0000001", "1000000"]) assert.throws(() => parseAmount(value));
});

test("exact-output dry quote requests the precise remaining balance", () => {
  const q = createQuoteRequest("ethereum", 60000000);
  assert.equal(q.dry, true);
  assert.equal(q.swapType, "EXACT_OUTPUT");
  assert.equal(q.amount, "60000000");
  const ok = { quoteRequest: q, quote: { amountIn: "60100000", amountInFormatted: "60.1", amountOut: q.amount } };
  assert.equal(quoteView(ok, "ethereum", 60000000).amountIn, "60.1");
  assert.throws(() => quoteView({ ...ok, quote: { ...ok.quote, depositAddress: "unexpected" } }, "ethereum", 60000000));
  assert.throws(() => quoteView(ok, "ethereum", 100000000));
});

test("NEAR receipt binds finality, sender, recipient, exact value and creation time", () => {
  const invoice = { recipient: "shop.testnet" }, attempt = { amount: 40000, created: 12 };
  const sender = "buyer.testnet", hash = "example";
  const outcome = { final_execution_status: "FINAL", status: { SuccessValue: "" },
    transaction: { hash, signer_id: sender, receiver_id: invoice.recipient, actions: [{ Transfer: { deposit: "40000000000000000000000" } }] } };
  const verify = (value, timestamp = "13000000") => verifyTransfer(value, invoice, attempt, sender, hash, timestamp);
  verify(outcome);
  assert.throws(() => verify({ ...outcome, final_execution_status: "EXECUTED" }));
  assert.throws(() => verify({ ...outcome, status: { Failure: {} } }));
  assert.throws(() => verify({ ...outcome, transaction: { ...outcome.transaction, receiver_id: "other.testnet" } }));
  assert.throws(() => verify({ ...outcome, transaction: { ...outcome.transaction, actions: [{ Transfer: { deposit: "1" } }] } }));
  assert.throws(() => verify(outcome, "11999999"));
});

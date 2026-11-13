import { Account, KeyPair, KeyPairSigner, actions } from "near-api-js";
const origin = process.env.DEMO_URL ?? "https://balancedue.ajnasnb.workers.dev";
const rpc = "https://rpc.testnet.fastnear.com";
const runId = Date.now().toString(36);

async function createAccount(role) {
  const id = "balancedue-" + role + "-" + runId + ".testnet";
  const key = KeyPair.fromRandom("ed25519");
  const response = await fetch("https://helper.testnet.near.org/account", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newAccountId: id, newAccountPublicKey: key.getPublicKey().toString() }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error("Testnet faucet returned " + response.status);
  const result = await response.json();
  if (result.status?.Failure) throw Error("Testnet account creation failed");
  return new Account(id, rpc, new KeyPairSigner(key));
}

async function post(path, data) {
  const r = await fetch(origin + "/api/invoices" + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error ?? String(r.status));
  return j;
}

const [merchant, payer1, payer2] = await Promise.all(["shop", "payer-a", "payer-b"].map(createAccount));
for (const a of [merchant, payer1, payer2]) await a.getState();
const invoice = await post("", {
  label: "Two wallet settlement", merchant: "Morrow Studio", mode: "testnet", amount: "0.1", recipient: merchant.accountId,
});
const proofs = [];
for (const [account, amount, yocto] of [[payer1, "0.04", 4n * 10n ** 22n], [payer2, "0.06", 6n * 10n ** 22n]]) {
  const pending = await post("/" + invoice.id + "/attempts", { amount });
  const tx = await account.signAndSendTransaction({ receiverId: merchant.accountId, actions: [actions.transfer(yocto)], waitUntil: "FINAL" });
  const hash = tx.transaction.hash;
  const path = "/" + invoice.id + "/attempts/" + pending.pending.id;
  const body = { sender: account.accountId, hash };
  const final = await post(path, body);
  const repeated = await post(path, body);
  if (final.paid !== repeated.paid || final.attempts.length !== repeated.attempts.length) throw Error("Replay changed the invoice");
  proofs.push({ payer: account.accountId, hash, amount, remaining: final.remaining });
}
console.log(JSON.stringify({ url: origin + "/?invoice=" + invoice.id, id: invoice.id, recipient: merchant.accountId, proofs }, null, 2));

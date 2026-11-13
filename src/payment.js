export const UNIT = 1_000_000;
export const BASE_USDC = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
export const ROUTES = {
  arbitrum: { label: "USDC · Arbitrum", asset: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near" },
  ethereum: { label: "USDT · Ethereum", asset: "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near" },
};
export const accountId = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
export const txHash = /^[1-9A-HJ-NP-Za-km-z]{43,45}$/;

export class Problem extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function parseAmount(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value)) {
    throw new Problem(400, "Enter an amount with up to six decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * UNIT + Number(fraction.padEnd(6, "0"));
  if (!amount) throw new Problem(400, "The amount must be greater than zero.");
  return amount;
}

export function verifyTransfer(result, invoice, attempt, sender, hash, blockTimestamp) {
  const tx = result?.transaction;
  const action = tx?.actions?.[0];
  const expected = (BigInt(attempt.amount) * 10n ** 18n).toString();
  if (result?.final_execution_status !== "FINAL" || typeof result?.status?.SuccessValue !== "string") {
    throw new Problem(409, "The transfer is not final and successful yet.");
  }
  if (tx?.hash !== hash || tx?.signer_id !== sender || tx?.receiver_id !== invoice.recipient ||
      tx?.actions?.length !== 1 || action?.Transfer?.deposit !== expected) {
    throw new Problem(409, "The sender, recipient or amount does not match this attempt.");
  }
  if (!/^\d+$/.test(String(blockTimestamp ?? "")) ||
      BigInt(blockTimestamp) < BigInt(attempt.created) * 1_000_000n) {
    throw new Problem(409, "The transfer predates this payment attempt.");
  }
}

export function createQuoteRequest(route, amount) {
  if (!Object.hasOwn(ROUTES, route)) throw new Problem(400, "Select a supported route.");
  return {
    dry: true, swapType: "EXACT_OUTPUT", slippageTolerance: 100,
    originAsset: ROUTES[route].asset, depositType: "ORIGIN_CHAIN",
    destinationAsset: BASE_USDC, amount: String(amount),
    recipient: "0x1111111111111111111111111111111111111111", recipientType: "DESTINATION_CHAIN",
    refundTo: "0x1111111111111111111111111111111111111111", refundType: "ORIGIN_CHAIN",
    deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
  };
}

export function quoteView(data, route, amount) {
  const q = data?.quote;
  if (data?.quoteRequest?.dry !== true || q?.depositAddress || !/^\d+$/.test(q?.amountIn ?? "") ||
      q?.amountOut !== String(amount) || typeof q?.amountInFormatted !== "string") {
    throw new Problem(502, "The route did not return a usable preview.");
  }
  return { route: ROUTES[route].label, amountIn: q.amountInFormatted, output: amount, expires: q.deadline ?? null };
}

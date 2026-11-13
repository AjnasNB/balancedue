import { Problem, ROUTES, accountId, createQuoteRequest, parseAmount, quoteView, txHash, verifyTransfer } from "./payment.js";

const response = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function readBody(request) {
  const bytes = await request.text();
  if (bytes.length > 4096) throw new Problem(413, "Request is too large.");
  try {
    const body = JSON.parse(bytes);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
    return body;
  } catch { throw new Problem(400, "Send a JSON object."); }
}

async function getInvoice(db, id) {
  const invoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first();
  if (!invoice) throw new Problem(404, "Invoice not found.");
  return invoice;
}

async function snapshot(db, invoice) {
  const { results } = await db.prepare("SELECT id, amount, route, state, created, proof, sender FROM attempts WHERE invoice = ? ORDER BY created, id").bind(invoice.id).all();
  const paid = results.reduce((sum, item) => sum + (item.state === "confirmed" ? item.amount : 0), 0);
  const pending = results.find(item => item.state === "pending") ?? null;
  return { ...invoice, paid, remaining: invoice.total - paid, pending, attempts: results };
}

async function createInvoice(db, body) {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const merchant = typeof body.merchant === "string" ? body.merchant.trim() : "";
  const mode = body.mode ?? "demo";
  const recipient = mode === "testnet" ? body.recipient : null;
  if (!label || label.length > 80 || !merchant || merchant.length > 60) {
    throw new Problem(400, "Enter a business name and an invoice description.");
  }
  if (!["demo", "testnet"].includes(mode)) throw new Problem(400, "Unknown checkout mode.");
  if (mode === "testnet" && (typeof recipient !== "string" || recipient.length > 64 ||
      recipient.length < 2 || !accountId.test(recipient))) {
    throw new Problem(400, "Enter a valid NEAR testnet recipient account.");
  }
  const id = crypto.randomUUID();
  const total = parseAmount(body.amount);
  const created = Date.now();
  await db.prepare("INSERT INTO invoices VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, label, merchant, total, mode, recipient, created).run();
  return snapshot(db, { id, label, merchant, total, mode, recipient, created });
}

async function begin(db, invoice, body) {
  const amount = parseAmount(body.amount);
  const route = invoice.mode === "testnet" ? "testnet" : body.route;
  if (!Object.hasOwn(ROUTES, route) && route !== "testnet" || invoice.mode === "demo" && route === "testnet") {
    throw new Problem(400, "Select a supported route.");
  }
  const result = await db.prepare(`
    INSERT INTO attempts (id,invoice,amount,route,state,created)
    SELECT ?,id,?,?,'pending',? FROM invoices
    WHERE id=? AND NOT EXISTS (SELECT 1 FROM attempts WHERE invoice=? AND state='pending')
    AND ? <= total - (SELECT COALESCE(SUM(amount),0) FROM attempts WHERE invoice=? AND state='confirmed')
  `).bind(crypto.randomUUID(), amount, route, Date.now(), invoice.id, invoice.id, amount, invoice.id).run();
  if (!result.meta.changes) throw new Problem(409, "Refresh the invoice. A payment is pending or the balance changed.");
  return snapshot(db, invoice);
}

async function rpc(method, params) {
  const r = await fetch("https://rpc.testnet.fastnear.com", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "balancedue", method, params }),
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Problem(502, "NEAR testnet is unavailable. Try again.");
  const data = await r.json();
  if (data.error) throw new Problem(409, "The testnet transfer is not available yet.");
  return data.result;
}

async function resolve(db, invoice, attemptId, body) {
  const attempt = await db.prepare("SELECT * FROM attempts WHERE invoice=? AND id=?").bind(invoice.id, attemptId).first();
  if (!attempt) throw new Problem(404, "Payment attempt not found.");
  if (attempt.state !== "pending") return snapshot(db, invoice);
  let proof, sender = null;
  let state = "confirmed";
  if (invoice.mode === "testnet") {
    sender = body.sender;
    if (typeof sender !== "string" || sender.length > 64 || sender.length < 2 || !accountId.test(sender) ||
        typeof body.hash !== "string" || !txHash.test(body.hash)) {
      throw new Problem(400, "Enter the sender account and testnet transaction hash.");
    }
    const result = await rpc("tx", { tx_hash: body.hash, sender_account_id: sender, wait_until: "FINAL" });
    const block = await rpc("block", { block_id: result?.transaction_outcome?.block_hash });
    verifyTransfer(result, invoice, attempt, sender, body.hash, block?.header?.timestamp_nanosec);
    proof = "testnet:" + body.hash;
  } else {
    if (!["confirmed", "failed"].includes(body.outcome)) throw new Problem(400, "Select a demo outcome.");
    state = body.outcome;
    proof = state === "confirmed" ? "demo:" + attempt.id : null;
  }
  try {
    await db.prepare("UPDATE attempts SET state=?, proof=?, sender=? WHERE id=? AND invoice=? AND state='pending'")
      .bind(state, proof, sender, attempt.id, invoice.id).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new Problem(409, "This transfer is already linked to another attempt.");
    throw error;
  }
  return snapshot(db, invoice);
}

async function preview(invoice, body) {
  if (invoice.mode !== "demo") throw new Problem(400, "Quote preview is available on USDC invoices.");
  if (invoice.pending || !invoice.remaining) throw new Problem(409, "A quote needs an open balance with no pending payment.");
  const quote = createQuoteRequest(body.route, invoice.remaining);
  const remote = await fetch("https://1click.chaindefuser.com/v0/quote", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(quote),
    signal: AbortSignal.timeout(12000),
  });
  if (!remote.ok) throw new Problem(502, "No live quote is available for this route and amount.");
  return quoteView(await remote.json(), body.route, invoice.remaining);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" && (url.searchParams.has("invoice") || url.searchParams.has("new"))) {
      return env.ASSETS.fetch(new Request(new URL("/checkout", url), request));
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (request.method === "POST") {
        if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) throw new Problem(403, "Origin not permitted.");
        if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new Problem(415, "Expected JSON.");
      }
      const db = env.DB;
      if (url.pathname === "/api/invoices" && request.method === "POST") return response(await createInvoice(db, await readBody(request)), 201);
      const match = /^\/api\/invoices\/([a-f0-9-]{36})(?:\/(attempts|quote)(?:\/([a-f0-9-]{36}))?)?$/.exec(url.pathname);
      if (!match) throw new Problem(404, "Page not found.");
      const [, id, action, attempt] = match;
      const invoice = await getInvoice(db, id);
      if (request.method === "GET" && !action) return response(await snapshot(db, invoice));
      if (request.method === "POST" && action) {
        const body = await readBody(request);
        if (action === "attempts" && !attempt) return response(await begin(db, invoice, body), 201);
        if (action === "attempts") return response(await resolve(db, invoice, attempt, body));
        if (!attempt) return response(await preview(await snapshot(db, invoice), body));
      }
      throw new Problem(405, "Method not allowed.");
    } catch (error) {
      if (!(error instanceof Problem)) console.error("Request failed", error?.name);
      return response({ error: error instanceof Problem ? error.message : "Something went wrong. Try again." }, error instanceof Problem ? error.status : 500);
    }
  },
};

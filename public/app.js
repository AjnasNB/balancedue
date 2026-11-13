const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const id = params.get("invoice");
const money = value => (value / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const decimal = value => (value / 1_000_000).toFixed(6).replace(/\.?0+$/, "");
const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
const routeNames = { arbitrum: "USDC · Arbitrum", ethereum: "USDT · Ethereum", testnet: "NEAR testnet" };
const sampleTestnet = { id: "305b9d46-7f05-4982-adca-1532f1572c82", recipient: "balancedue-shop-mwf26ezn.testnet" };
let invoice;

async function api(path, body) {
  const response = await fetch("/api/invoices" + path, body === undefined ? {} : {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  return data;
}

function notice(message, error = false) {
  const status = document.querySelector("#notice");
  if (status) { status.textContent = message; status.classList.toggle("error", error); }
}
function work(button, fn) {
  button.disabled = true;
  notice("");
  return fn().catch(e => notice(e.message, true)).finally(() => { button.disabled = false; });
}

function stage(kicker, title, copy, card) {
  app.innerHTML = `<div class="layout"><section class="intro"><div class="kicker"><span class="dot"></span>${kicker}</div><h1>${title}</h1><p>${copy}</p><div class="hero" aria-hidden="true"><span class="coin">$</span><i class="route-line"></i><span class="coin">✓</span></div></section>${card}</div>`;
  app.setAttribute("aria-busy", "false");
}

function createPage() {
  stage("Stablecoin checkout", "Pick up where<br><em>you left off.</em>", "Pay part of an invoice now. Come back with a different wallet to finish it. The merchant gets one receipt.",
    `<section class="card"><h2>Create an invoice</h2><form id="create" class="stack">
      <label>Business name<input name="merchant" value="Morrow Studio" maxlength="60" required></label>
      <label>Description<input name="label" value="Brand identity project" maxlength="80" required></label>
      <div class="line"><label>Amount<input name="amount" value="100" inputmode="decimal" required></label>
      <label>Payment mode<select name="mode"><option value="demo">USDC simulation</option><option value="testnet">NEAR testnet</option></select></label></div>
      <label id="testnet-label" hidden>NEAR testnet recipient<input name="recipient" value="${sampleTestnet.recipient}" maxlength="64"></label>
      <button class="primary full">Create invoice</button>
      </form><p id="notice" class="notice" role="status"></p>
      ${sampleTestnet.id ? `<a class="toplink" href="/?invoice=${sampleTestnet.id}">View a verified testnet receipt ↗</a>` : ""}</section>`);
  const form = document.querySelector("#create");
  form.elements.mode.addEventListener("change", () => { document.querySelector("#testnet-label").hidden = form.elements.mode.value !== "testnet"; });
  form.addEventListener("submit", event => {
    event.preventDefault();
    work(event.submitter, async () => {
      const created = await api("", Object.fromEntries(new FormData(form)));
      location.href = "/?invoice=" + created.id;
    });
  });
}

function invoicePage() {
  const { total, paid, remaining, pending, attempts, mode, recipient, label, merchant } = invoice;
  const isTestnet = mode === "testnet";
  const unit = isTestnet ? "NEAR" : "USDC";
  const complete = remaining === 0;
  const confirmed = attempts.filter(x => x.state === "confirmed");
  const failed = attempts.filter(x => x.state === "failed").length;
  const state = complete ? "Paid" : pending ? "Payment pending" : paid ? "Partially paid" : "Awaiting payment";
  const activity = confirmed.map(x => `<div class="row"><div class="line"><span>${routeNames[x.route]}</span><strong>${money(x.amount)} ${unit}</strong></div>${isTestnet ? `<a class="quiet wrap" href="https://testnet.nearblocks.io/txns/${escape(x.proof.split(":")[1])}" target="_blank" rel="noreferrer">View confirmed transfer ↗</a>` : "<span class='quiet'>Simulated settlement</span>"}</div>`).join("");
  const entry = complete ? '<div class="box paid"><strong>Payment complete</strong>The full invoice amount has been received.</div>'
    : pending ? `<div class="box"><strong>${money(pending.amount)} ${unit} pending</strong>Keep this link to check the same attempt.</div>
      ${isTestnet ? `<div class="box wrap"><strong>Send ${money(pending.amount)} NEAR on testnet</strong>${escape(recipient)}</div><form id="verify" class="stack"><label>Sender account<input name="sender" required></label><label>Transaction hash<input name="hash" required></label><button class="primary">Verify testnet transfer</button></form>`
        : '<div class="line"><button id="confirm" class="primary">Confirm simulated payment</button><button id="fail" class="secondary">Simulate failure</button></div>'}`
    : `<form id="pay" class="stack"><label>Amount to pay (${unit})<input name="amount" value="${decimal(remaining)}" inputmode="decimal" required></label>
      ${isTestnet ? "" : '<label>Payment route<select name="route"><option value="arbitrum">USDC · Arbitrum</option><option value="ethereum">USDT · Ethereum</option></select></label>'}
      <button class="primary">${isTestnet ? "Start testnet payment" : "Start simulated payment"}</button>
      ${isTestnet ? "" : '<button id="quote" type="button" class="secondary">Preview live quote for remaining balance</button><p id="quote-output" class="quiet" role="status"></p>'}</form>`;
  stage(isTestnet ? "NEAR testnet · no monetary value" : "Simulation · no funds move", complete ? "One invoice.<br><em>Paid in full.</em>" : "One invoice.<br><em>Pay in parts.</em>",
    complete ? "Both sides can reopen this link and see the same receipt." : "The link keeps track of confirmed payments. Come back whenever you’re ready to pay the rest.",
    `<section class="card checkout"><div class="line"><p class="quiet">${escape(merchant)}</p><span class="pill">${state}</span></div>
      <h2>${escape(label)}</h2>
      <div class="balance"><div class="quiet">Amount remaining</div><span class="number">${money(remaining)}</span><span class="unit">${unit}</span><div class="progress" aria-label="${Math.round(paid/total*100)} percent paid"><span style="width:${paid/total*100}%"></span></div><div class="line quiet"><span>Received ${money(paid)}</span><span>Total ${money(total)}</span></div></div>
      <div class="stack">${entry}</div>
      ${activity ? `<div class="section-title">${complete ? "Receipt" : "Confirmed payments"}</div>${activity}` : ""}
      ${failed ? `<p class="quiet">${failed} failed attempt${failed === 1 ? "" : "s"} · no balance change</p>` : ""}
      <div class="line"><button id="copy" class="secondary">Copy invoice link</button><button id="refresh" class="secondary">Refresh</button></div>
      <p id="notice" class="notice" role="status"></p></section>`);
  const action = async (path, body) => { invoice = await api("/" + id + path, body); invoicePage(); };
  const attemptPath = pending ? "/attempts/" + pending.id : "";
  document.querySelector("#pay")?.addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    work(e.submitter, () => action("/attempts", data));
  });
  document.querySelector("#verify")?.addEventListener("submit", e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    work(e.submitter, () => action(attemptPath, data));
  });
  document.querySelector("#quote")?.addEventListener("click", e => {
    const route = document.querySelector("[name=route]").value;
    work(e.currentTarget, async () => {
      const q = await api("/" + id + "/quote", {route});
      document.querySelector("#quote-output").textContent = `Live preview: ${q.amountIn} ${q.route} → ${money(q.output)} USDC on Base. No funds move.`;
    });
  });
  document.querySelector("#confirm")?.addEventListener("click", e => work(e.currentTarget, () => action(attemptPath, {outcome:"confirmed"})));
  document.querySelector("#fail")?.addEventListener("click", e => work(e.currentTarget, () => action(attemptPath, {outcome:"failed"})));
  document.querySelector("#refresh").addEventListener("click", e => work(e.currentTarget, () => action("")));
  document.querySelector("#copy").addEventListener("click", e => work(e.currentTarget, async () => { await navigator.clipboard.writeText(location.href); notice("Invoice link copied."); }));
}

if (id) {
  api("/" + encodeURIComponent(id)).then(data => { invoice = data; invoicePage(); })
    .catch(e => stage("Invoice", "Link unavailable", "Open a valid invoice link or create a new invoice.",
      `<section class="card"><p>${escape(e.message)}</p><a href="/?new=1" class="primary">Create an invoice</a></section>`));
} else createPage();

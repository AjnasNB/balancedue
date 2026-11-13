import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.DEMO_URL ?? "https://balancedue.ajnasnb.workers.dev";
const target = new URL(origin);
if (target.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(target.hostname)) throw Error("Use HTTPS or localhost.");
const dir = process.env.DEMO_CAPTURE === "1" ? "artifacts" : null;
if (dir) await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: {width: 1440, height: 980}, ...(dir ? {recordVideo:{dir,size:{width:1440,height:980}}} : {}) });
const page = await context.newPage();
const button = (p, name) => p.getByRole("button", { name, exact:true });
const screenshot = async (p, name) => {
  if (!dir) return;
  await p.evaluate(() => document.fonts.ready.then(() => null));
  await p.screenshot({path:dir + "/" + name + ".png",animations:"disabled"});
};

async function request(url, body, expected = 200) {
  const r = await fetch(url, body === undefined ? {} : {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result = await r.json();
  assert.equal(r.status, expected, JSON.stringify(result));
  return result;
}

try {
  await page.goto(origin);
  await page.getByRole("heading",{name:"Create an invoice"}).waitFor();
  assert.equal(await page.getByLabel("NEAR testnet recipient").isVisible(),false);
  await screenshot(page,"01-create");
  await button(page,"Create invoice").click();
  await page.getByText("Awaiting payment",{exact:true}).waitFor();
  const url = page.url();
  const id = new URL(url).searchParams.get("invoice");
  const api = origin + "/api/invoices/" + id;
  await page.getByLabel("Amount to pay (USDC)").fill("40");
  await button(page,"Start simulated payment").click();
  await page.getByText("Payment pending",{exact:true}).waitFor();
  await request(api+"/attempts",{amount:"40",route:"arbitrum"},409);
  const first = await request(api);
  await button(page,"Confirm simulated payment").click();
  await page.getByText("Partially paid",{exact:true}).waitFor();
  await screenshot(page,"02-partial");
  const replay = await request(api+"/attempts/"+first.pending.id,{outcome:"confirmed"});
  assert.equal(replay.paid,40000000);

  const other = await browser.newContext({ viewport:{width:1440,height:980}, ...(dir ? {recordVideo:{dir,size:{width:1440,height:980}}} : {}) });
  const resume = await other.newPage();
  await resume.goto(url);
  await resume.getByText("Partially paid",{exact:true}).waitFor();
  assert.equal(await resume.getByLabel("Amount to pay (USDC)").inputValue(),"60");
  await resume.getByLabel("Payment route").selectOption("ethereum");
  await button(resume,"Preview live quote for remaining balance").click();
  await resume.getByText(/Live preview: .*60\.00 USDC on Base/).waitFor({timeout:20000});
  await screenshot(resume,"03-quote");
  await button(resume,"Start simulated payment").click();
  await resume.getByText("60.00 USDC pending").waitFor();
  await resume.reload();
  await resume.getByText("60.00 USDC pending").waitFor();
  await button(resume,"Simulate failure").click();
  await resume.getByText(/1 failed attempt/).waitFor();
  assert.equal(await resume.getByLabel("Amount to pay (USDC)").inputValue(),"60");
  await screenshot(resume,"04-failed");
  await request(api+"/attempts",{amount:"60.01",route:"ethereum"},409);
  await resume.getByLabel("Payment route").selectOption("ethereum");
  await button(resume,"Start simulated payment").click();
  await button(resume,"Confirm simulated payment").click();
  await resume.getByText("Payment complete",{exact:true}).waitFor();
  await screenshot(resume,"05-paid");
  const done = await request(api);
  assert.equal(done.paid,100000000);
  assert.equal(done.remaining,0);
  assert.equal(done.attempts.filter(x=>x.state==="confirmed").length,2);
  await request(api+"/attempts",{amount:"1",route:"ethereum"},409);
  await other.close();
  const mobile = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.goto(url);
  await mobile.getByText("Payment complete",{exact:true}).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  await screenshot(mobile,"06-mobile");
  await mobile.close();
  if (process.env.TESTNET_RECEIPT) {
    await page.goto(process.env.TESTNET_RECEIPT);
    await page.getByText("Payment complete",{exact:true}).waitFor();
    assert.equal(await page.getByRole("link",{name:"View confirmed transfer ↗"}).count(),2);
    await screenshot(page,"07-testnet");
  }
  console.log(JSON.stringify({ invoice:url, checks:["fresh browser","pending refresh","blocked concurrent attempt","failed attempt retry","quote","idempotent settlement","overpayment rejection","mobile","two transfers"] }));
} finally {
  await context.close();
  await browser.close();
}

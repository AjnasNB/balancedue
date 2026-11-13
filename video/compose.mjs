import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const scenes = [
  { label: "RESUMABLE CRYPTO INVOICES", title: "Pay in parts.", detail: "One invoice keeps track of the balance across wallets.", image: "01-create.png" },
  { label: "SIMULATED CHECKOUT", title: "Pick up where you left off.", detail: "$40 paid. $60 remaining. The same link works in a fresh browser.", image: "02-partial.png" },
  { label: "LIVE NEAR INTENTS QUOTE", title: "Quote the exact balance.", detail: "USDT on Ethereum → 60 USDC on Base. Quote only.", image: "03-quote.png" },
  { label: "SIMULATED CHECKOUT", title: "Retry a failed payment.", detail: "A failed attempt leaves the balance intact. Two confirmed payments settle the invoice.", image: "04-failed.png", result: "05-paid.png" },
  { label: "VERIFIED NEAR TESTNET TRANSFERS", title: "Two wallets. One receipt.", detail: "0.04 + 0.06 testnet NEAR. Both transfers verified on-chain.", image: "07-testnet.png" },
  { label: "BUILT FOR NEAR HACKATHON", title: "BalanceDue", detail: "Try the checkout", link: "balancedue.ajnasnb.workers.dev" },
];

let start = 0;
const timed = scenes.map((scene, index) => {
  const voice = "voice-" + index + ".wav";
  const length = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", "video/render/" + voice], { encoding: "utf8" }).trim());
  if (!Number.isFinite(length) || length <= 0) throw new Error("Invalid narration duration: " + voice);
  const duration = Math.ceil(length + 0.7);
  const timedScene = { ...scene, index, start, duration, voice };
  start += duration;
  return timedScene;
});

const clips = timed.map(({ index, start, duration, label, title, detail, image, result, link, voice }) => `
  <section id="scene-${index}" class="clip scene${link ? " closing" : ""}" data-start="${start}" data-duration="${duration}" data-track-index="1">
    <div class="copy"><p class="label">${label}</p><h1>${title}</h1><p class="detail">${detail}</p>${link ? `<p class="url">${link}</p>` : ""}</div>
    ${image ? `<div class="shot"><img src="${image}" alt="">${result ? `<img class="result" src="${result}" alt="">` : ""}</div>` : ""}
  </section>
  <audio id="voice-${index}" class="clip" data-start="${start}" data-duration="${duration}" data-track-index="2" data-volume="1" src="${voice}"></audio>
`).join("");
const template = readFileSync("video/composition.html", "utf8");
writeFileSync("video/render/index.html", template.replace("{{duration}}", String(start)).replace("{{clips}}", clips));

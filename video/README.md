# Reproduce the demo video

From the repository root on Windows with Chrome, FFmpeg, ffprobe and the Microsoft David Desktop voice installed:

```powershell
npm ci
$env:DEMO_CAPTURE = "1"
$env:TESTNET_RECEIPT = "https://balancedue.ajnasnb.workers.dev/?invoice=305b9d46-7f05-4982-adca-1532f1572c82"
node scripts/browser-demo.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File video/prepare.ps1
npx --yes hyperframes@0.9.41 check video/render
npx --yes hyperframes@0.9.41 render video/render --output artifacts/balancedue-demo.mp4 --quality looks --fps 24 --workers 2
```

The browser regression saves screenshots and WebM recordings under `artifacts/`. The render script builds its timed scene layout from `composition.html`, `compose.mjs` and the six narration paragraphs. The recording and narration use synthetic invoice data.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$renderPath = Join-Path $PSScriptRoot "render"
New-Item -ItemType Directory -Path $renderPath -Force | Out-Null
Add-Type -AssemblyName System.Speech
$lines = (Get-Content video/narration.txt -Raw).Trim() -split "\r?\n\s*\r?\n"
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voice.SelectVoice("Microsoft David Desktop")
    $voice.Rate = -1
    for ($index = 0; $index -lt $lines.Count; $index++) {
        $voice.SetOutputToWaveFile((Join-Path $renderPath "voice-$index.wav"))
        $voice.Speak($lines[$index])
        $voice.SetOutputToNull()
    }
} finally {
    $voice.Dispose()
}
Copy-Item artifacts/0*.png $renderPath
Copy-Item node_modules/gsap/dist/gsap.min.js $renderPath
node video/compose.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

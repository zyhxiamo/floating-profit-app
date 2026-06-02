Add-Type -AssemblyName System.Speech

$voicePath = Join-Path $PSScriptRoot "narration.wav"
$text = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot "narration.txt")

$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$speaker.SelectVoice("Microsoft Huihui Desktop")
$speaker.Rate = 2
$speaker.Volume = 100
$speaker.SetOutputToWaveFile($voicePath)
$speaker.Speak($text)
$speaker.Dispose()

Write-Host "Narration generated: $voicePath"

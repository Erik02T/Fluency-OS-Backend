$ErrorActionPreference = 'Stop'

$modelRelease = 'opus-2021-02-23'
$cacheRoot = Join-Path $HOME '.cache\fluency-os\opus'
$archivePath = Join-Path $cacheRoot "$modelRelease.zip"
$sourceModelPath = Join-Path $cacheRoot $modelRelease
$convertedModelPath = Join-Path $cacheRoot "$modelRelease-ct2-int8"
$venvRoot = Join-Path $PSScriptRoot '..\..\.venv'
$converter = Join-Path $venvRoot 'Scripts\ct2-opus-mt-converter.exe'
$modelUrl = "https://object.pouta.csc.fi/Tatoeba-MT-models/jpn-por/$modelRelease.zip"

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

if (-not (Test-Path $archivePath)) {
  Invoke-WebRequest -Uri $modelUrl -OutFile $archivePath
}

if (-not (Test-Path (Join-Path $sourceModelPath 'decoder.yml'))) {
  New-Item -ItemType Directory -Force -Path $sourceModelPath | Out-Null
  Expand-Archive -LiteralPath $archivePath -DestinationPath $sourceModelPath -Force
}

if (-not (Test-Path $converter)) {
  throw "Conversor não encontrado: $converter. Instale scripts/grammar/local-translation-requirements.txt no backend/.venv."
}

$modelBinary = Join-Path $convertedModelPath 'model.bin'
if (-not (Test-Path $modelBinary)) {
  & $converter --model_dir $sourceModelPath --output_dir $convertedModelPath --quantization int8
  if ($LASTEXITCODE -ne 0) {
    throw "A conversão CTranslate2 terminou com código $LASTEXITCODE."
  }
}

foreach ($file in @('source.spm', 'target.spm', 'LICENSE', 'opus-2021-02-23.yml')) {
  Copy-Item -LiteralPath (Join-Path $sourceModelPath $file) -Destination $convertedModelPath -Force
}

Write-Output "Modelo OPUS-MT pronto: $convertedModelPath"
Write-Output "Licença e attribution: $convertedModelPath\LICENSE"
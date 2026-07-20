param(
  [string]$Toktx = $env:TOKTX
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $root "public\assets\shared\frame-materials"
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source

if (-not $Toktx) {
  $command = Get-Command toktx -ErrorAction SilentlyContinue
  $Toktx = if ($command) {
    $command.Source
  } else {
    Join-Path $env:TEMP "ktx-tools-4.4.2\bin\toktx.exe"
  }
}
if (-not (Test-Path -LiteralPath $Toktx -PathType Leaf)) {
  throw "toktx 4.4.2 not found. Set TOKTX to the executable from https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2"
}

$work = Join-Path $env:TEMP "parallax-frame-ktx2"
New-Item -ItemType Directory -Force -Path $work | Out-Null
$sources = Get-ChildItem -LiteralPath $sourceRoot -Recurse -Filter "*_2k.webp" | Sort-Object FullName

foreach ($source in $sources) {
  $png = Join-Path $work ($source.BaseName + ".png")
  $output = [IO.Path]::ChangeExtension($source.FullName, ".ktx2")

  & $ffmpeg -hide_banner -loglevel error -y -i $source.FullName -frames:v 1 $png
  if ($LASTEXITCODE) { throw "ffmpeg failed for $($source.FullName)" }

  $linear = $source.Name -notmatch "_diff_"
  $swizzle = if ($source.Name -match "_rough_") { "rrr1" } else { "rgb1" }
  $colorArgs = if ($linear) {
    @("--assign_oetf", "linear", "--assign_primaries", "none")
  } else {
    @("--assign_oetf", "srgb", "--assign_primaries", "srgb")
  }

  & $Toktx --encode etc1s --clevel 5 --qlevel 255 --genmipmap `
    --input_swizzle $swizzle --lower_left_maps_to_s0t0 @colorArgs $output $png
  if ($LASTEXITCODE -or -not (Test-Path -LiteralPath $output)) {
    throw "toktx failed for $($source.FullName)"
  }

  Remove-Item -LiteralPath $png
}

$outputs = Get-ChildItem -LiteralPath $sourceRoot -Recurse -Filter "*.ktx2"
if ($outputs.Count -ne $sources.Count) {
  throw "Expected $($sources.Count) KTX2 files, found $($outputs.Count)"
}

[pscustomobject]@{
  Textures = $outputs.Count
  WebPBytes = ($sources | Measure-Object Length -Sum).Sum
  KTX2Bytes = ($outputs | Measure-Object Length -Sum).Sum
}

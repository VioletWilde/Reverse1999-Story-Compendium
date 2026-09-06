param(
    [string]$NodePath = 'node'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$packageName = 'Reverse-1999-剧情网页版'
$packageDirectory = Join-Path (Join-Path $repositoryRoot 'dist') $packageName
$zipPath = Join-Path (Join-Path $repositoryRoot 'dist') "$packageName.zip"

Push-Location $repositoryRoot
try {
    & $NodePath (Join-Path $PSScriptRoot 'build_offline_reader.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Reader generator exited with code $LASTEXITCODE" }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $packageDirectory '*') -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Output "Offline reader created: $zipPath"
}
finally {
    Pop-Location
}

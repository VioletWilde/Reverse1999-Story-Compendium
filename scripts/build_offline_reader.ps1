param(
    [string]$NodePath = 'node'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repositoryRoot
try {
    # The Node script builds the HTML package and the distribution ZIP itself.
    # Zipping in Node guarantees standard forward-slash entry paths and UTF-8
    # filename flags, which Compress-Archive/tar on Windows do not produce.
    & $NodePath (Join-Path $PSScriptRoot 'build_offline_reader.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Reader generator exited with code $LASTEXITCODE" }
}
finally {
    Pop-Location
}

$ErrorActionPreference = 'Stop'

function Find-Node {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) {
        $version = & $command.Source -p 'process.versions.node'
        if ($LASTEXITCODE -eq 0 -and [int]($version.Split('.')[0]) -ge 22) {
            return $command.Source
        }
    }
    return $null
}

try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    Set-Location -LiteralPath $projectRoot
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'apps/web/package.json'))) {
        throw 'Extract the complete project ZIP first, then double-click Start-XT.cmd.'
    }

    Write-Host 'XT Trade Journal AI - checking Node.js...' -ForegroundColor Cyan
    $nodePath = Find-Node
    if (-not $nodePath) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            throw 'Install Node.js LTS from https://nodejs.org/en/download, then run Start-XT.cmd again.'
        }
        Write-Host 'Installing Node.js LTS. Windows may show an installer permission dialog.'
        & winget.exe install --exact --id Microsoft.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            throw 'Node.js installation did not complete. Install Node.js LTS from https://nodejs.org/en/download, then retry.'
        }
        $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
        $env:Path = "$machinePath;$userPath;$env:Path"
        $nodePath = Find-Node
        if (-not $nodePath) {
            throw 'Node.js 22+ was not found. Close this window and run Start-XT.cmd again.'
        }
    }
    # Prefer npm from the same installation as Node; avoid old PATH entries.
    $env:Path = "$(Split-Path -Parent $nodePath);$env:Path"
    & $nodePath (Join-Path $PSScriptRoot 'start-xt.mjs')
    exit $LASTEXITCODE
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

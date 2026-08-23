[CmdletBinding()]
param(
    [string]$CdpEndpoint = "http://127.0.0.1:9222"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path $repo ".refresh.lock"
$logDirectory = Join-Path $repo "logs"
$logPath = Join-Path $logDirectory "hourly-refresh.log"
$lockStream = $null

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Write-RefreshLog {
    param([string]$Message)
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"), $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding utf8
    Write-Output $line
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [Parameter(ValueFromRemainingArguments)] [string[]]$Arguments
    )
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE."
    }
}

try {
    try {
        $lockStream = [System.IO.File]::Open($lockPath, "OpenOrCreate", "ReadWrite", "None")
    } catch [System.IO.IOException] {
        Write-RefreshLog "Skipped because another refresh is already running."
        exit 0
    }

    Set-Location -LiteralPath $repo
    Write-RefreshLog "Hourly refresh started."

    $dirty = @(git status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the Git worktree." }
    if ($dirty.Count -gt 0) { throw "Tracked worktree changes are present; refusing to mix them into an hourly commit." }

    Invoke-Checked git fetch origin main
    Invoke-Checked git merge --ff-only origin/main

    $env:DYL_NAWFUL_CDP_ENDPOINT = $CdpEndpoint
    $collected = $false
    for ($attempt = 1; $attempt -le 2 -and -not $collected; $attempt += 1) {
        try {
            Invoke-Checked node scripts/collect-x-posts.mjs data/browser-export.json
            $collected = $true
        } catch {
            Write-RefreshLog "Collection attempt $attempt failed: $($_.Exception.Message)"
            if ($attempt -eq 2) { throw }
        }
    }

    Invoke-Checked node scripts/build-snapshot.mjs
    Invoke-Checked npm test
    Invoke-Checked npm run validate

    git diff --quiet -- data/posts.json
    if ($LASTEXITCODE -eq 0) {
        Write-RefreshLog "No snapshot change was produced."
        exit 0
    }
    if ($LASTEXITCODE -ne 1) { throw "Unable to compare the refreshed snapshot." }

    Invoke-Checked git add -- data/posts.json
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm K"
    Invoke-Checked git commit -m "Refresh Dyl Nawful snapshot $stamp"
    Invoke-Checked git push origin main
    Write-RefreshLog "Hourly refresh pushed successfully."
} catch {
    Write-RefreshLog "Hourly refresh failed: $($_.Exception.Message)"
    exit 1
} finally {
    if ($null -ne $lockStream) { $lockStream.Dispose() }
}

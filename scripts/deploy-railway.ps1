<#
.SYNOPSIS
  Deploys the current code to Railway without touching the live data.

.DESCRIPTION
  1. Checks the Railway CLI is installed, logged in and linked (`railway link`) to a project.
  2. Runs all unit tests (skip with -SkipTests).
  3. Downloads a copy of the live database into backups/ on this PC (skip with -SkipBackup).
  4. Uploads the repo with `railway up` (Railway builds the Dockerfile).
  5. Waits until the live site answers again.

  Data safety: the database and pictures live on the Railway volume (/data), which deploys
  never replace. On every start the server also copies the database to /data/backups before
  migrations run. Migrations only ever add to the schema; they never reset data.

  Nothing personal is stored here: the project, service and URL come from your own Railway
  login and link, and secrets (admin PIN, JWT secret) stay in Railway variables.

  Note: `railway up` uploads your working folder, including uncommitted changes.

.EXAMPLE
  npm run deploy          # from frontend/
  npm run deploy:quick    # skip the tests
#>
param(
  [switch]$SkipTests,
  [switch]$SkipBackup
)

# Native tools write progress to stderr; rely on exit codes instead of PowerShell errors.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

function Say($text, $color = 'White') { Write-Host $text -ForegroundColor $color }
function Fail($text) { Say $text 'Red'; exit 1 }

Say ''
Say '  *** Deploying Pop Quiz to Railway ***' 'Magenta'
Say ''

# ---------- Railway CLI ----------
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Fail 'Railway CLI not found. Install it: npm install -g @railway/cli --allow-scripts=@railway/cli'
}

& railway whoami *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Not logged in to Railway. Run: railway login' }

Push-Location $root
try {
  & railway status *> $null
  if ($LASTEXITCODE -ne 0) { Fail 'This folder is not linked to a Railway project. Run: railway link' }

  # The public domain comes from the linked service, so no URL is hard-coded here.
  $domainLine = & railway variables --kv 2>$null | Where-Object { $_ -like 'RAILWAY_PUBLIC_DOMAIN=*' }
  $url = if ($domainLine) { 'https://' + ($domainLine -replace '^RAILWAY_PUBLIC_DOMAIN=', '') } else { $null }

  # ---------- Git info ----------
  $dirty = & git status --porcelain
  $commit = & git log -1 --format='%h %s'
  Say "Deploying: $commit" 'Cyan'
  if ($dirty) { Say 'Note: uncommitted changes will be deployed too.' 'Yellow' }

  # ---------- Tests ----------
  if (-not $SkipTests) {
    Say 'Running tests (a couple of minutes)...' 'Cyan'
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { Fail 'Tests failed, nothing was deployed. Fix them or use: npm run deploy:quick' }
  }

  # ---------- Backup of the live data ----------
  if (-not $SkipBackup) {
    $backups = Join-Path $root 'backups'
    New-Item -ItemType Directory -Force $backups | Out-Null
    $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    $target = Join-Path $backups "pop-quiz-$stamp.db"
    Say 'Downloading a backup of the live database...' 'Cyan'
    # Find the volume mounted at /data on the linked project (nothing hard-coded).
    $volume = $null
    try {
      $volumes = (& railway volume list --json 2>$null | Out-String | ConvertFrom-Json).volumes
      $volume = ($volumes | Where-Object { $_.mountPath -eq '/data' } | Select-Object -First 1).id
    } catch { $volume = $null }
    $output = ''
    if ($volume) {
      $output = & railway volume files --volume $volume download pop-quiz.db $target 2>&1 | Out-String
    }
    if ($volume -and (Test-Path $target)) {
      Say "Backup saved to backups\pop-quiz-$stamp.db" 'Green'
    } elseif ($output -match 'SSH') {
      Say 'Skipped the local copy: downloading needs an SSH key (one-time: railway ssh keys add).' 'Yellow'
      Say 'The server still backs up the database to /data/backups on every start.' 'Yellow'
    } else {
      Say 'No live database to copy yet (first deploy?). Continuing.' 'Yellow'
    }
  }

  # ---------- Deploy ----------
  Say 'Uploading and building on Railway (3-5 minutes)...' 'Cyan'
  & railway up --ci
  if ($LASTEXITCODE -ne 0) { Fail 'Railway build or deploy failed. See the log above, or run: railway logs' }

  # ---------- Health check ----------
  if (-not $url) {
    Say 'Deployed. No public domain found; add one with: railway domain' 'Yellow'
    return
  }
  Say 'Checking the live site...' 'Cyan'
  $healthy = $false
  for ($i = 0; $i -lt 40; $i++) {
    try {
      Invoke-WebRequest "$url/api/games" -UseBasicParsing -TimeoutSec 10 | Out-Null
      $healthy = $true
      break
    } catch { Start-Sleep -Seconds 3 }
  }
  if (-not $healthy) { Fail "Deployed, but $url isn't answering yet. Check: railway logs" }

  Say ''
  Say '  ============================================================' 'Green'
  Say '   Deployed! Live at:' 'Green'
  Say "   $url" 'Yellow'
  Say '  ============================================================' 'Green'
  Say ''
} finally {
  Pop-Location
}

<#
.SYNOPSIS
  Starts Chiara Pop Quiz on this PC and shares it through a public Cloudflare link.

.DESCRIPTION
  Builds the app, starts the production server, opens a free Cloudflare quick tunnel,
  shows the public link (and copies it to the clipboard) and keeps the PC awake.
  Press Ctrl+C to stop everything. The link changes every time you run this.

.EXAMPLE
  npm run party                      # from frontend/ (asks for the admin PIN)
  .\scripts\start-party.ps1 -AdminPassword 4321 -SkipBuild
#>
param(
  [string]$AdminPassword,
  [int]$Port = 3000,
  [switch]$SkipBuild,
  # Start everything, print the link, then stop. Used to check the setup works.
  [switch]$SmokeTest
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null

function Say($text, $color = 'White') { Write-Host $text -ForegroundColor $color }

function Stop-Tree($proc) {
  if ($proc -and -not $proc.HasExited) { & taskkill /T /F /PID $proc.Id 2>$null | Out-Null }
}

function Find-Cloudflared {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:ProgramFiles\cloudflared\cloudflared.exe",
    "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe"
  )
  return $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

# Keeps Windows from sleeping while the party runs.
Add-Type -Namespace PopQuiz -Name Power -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll")]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
$ES_CONTINUOUS = [uint32]'0x80000000'
$ES_AWAKE = [uint32]'0x80000003' # continuous + system + display required

Say ''
Say '  *** Chiara Pop Quiz: party mode ***' 'Magenta'
Say ''

# ---------- Checks ----------
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
  Say "Port $Port is already in use. Close the other server (or the old party window) and try again." 'Red'
  exit 1
}

$cloudflared = Find-Cloudflared
if (-not $cloudflared) {
  Say 'Installing cloudflared (one time)...' 'Yellow'
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements | Out-Null
  $cloudflared = Find-Cloudflared
  if (-not $cloudflared) { Say 'Could not install cloudflared. Install it from https://github.com/cloudflare/cloudflared' 'Red'; exit 1 }
}

if (-not $AdminPassword) {
  $AdminPassword = Read-Host 'Admin PIN for tonight (press Enter to keep 9999)'
}
if (-not $AdminPassword) {
  $AdminPassword = '9999'
  Say 'Using the default PIN 9999. Anyone with the link could guess it!' 'Yellow'
}

# ---------- Build ----------
if (-not $SkipBuild) {
  Say 'Building the app (about a minute)...' 'Cyan'
  Push-Location $root
  try {
    & npm.cmd run build *> (Join-Path $logs 'build.log')
    if ($LASTEXITCODE -ne 0) { Say "Build failed. See $logs\build.log" 'Red'; exit 1 }
  } finally { Pop-Location }
}

$server = $null
$tunnel = $null
try {
  [PopQuiz.Power]::SetThreadExecutionState($ES_AWAKE) | Out-Null

  # ---------- Server ----------
  Say 'Starting the quiz server...' 'Cyan'
  $env:PORT = "$Port"
  $env:ADMIN_PASSWORD = $AdminPassword
  $env:JWT_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  $server = Start-Process npm.cmd -ArgumentList 'run', 'start:prod' -WorkingDirectory (Join-Path $root 'backend') `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server.err.log')

  $ready = $false
  $lastError = ''
  for ($i = 0; $i -lt 60 -and -not $server.HasExited; $i++) {
    try { Invoke-WebRequest "http://127.0.0.1:$Port/api/games" -UseBasicParsing -TimeoutSec 5 | Out-Null; $ready = $true; break }
    catch { $lastError = $_.Exception.Message; Start-Sleep -Seconds 1 }
  }
  if (-not $ready) {
    Say "The server didn't start ($lastError). See $logs\server.err.log" 'Red'
    exit 1
  }

  # ---------- Tunnel ----------
  Say 'Opening the public link...' 'Cyan'
  $tunnelLog = Join-Path $logs 'tunnel.log'
  $tunnel = Start-Process $cloudflared -ArgumentList 'tunnel', '--no-autoupdate', '--url', "http://127.0.0.1:$Port" `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logs 'tunnel.out.log') -RedirectStandardError $tunnelLog

  $url = $null
  for ($i = 0; $i -lt 60 -and -not $tunnel.HasExited; $i++) {
    Start-Sleep -Seconds 1
    $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($match) { $url = $match.Matches[0].Value; break }
  }
  if (-not $url) { Say "Couldn't get a public link. Check your internet and $tunnelLog" 'Red'; exit 1 }

  # Give Cloudflare a moment to route the new hostname before announcing it.
  for ($i = 0; $i -lt 20; $i++) {
    try { Invoke-WebRequest "$url/api/games" -UseBasicParsing -TimeoutSec 5 | Out-Null; break }
    catch { Start-Sleep -Seconds 2 }
  }

  Set-Clipboard -Value $url
  Set-Content -Path (Join-Path $logs 'party-link.txt') -Value $url

  Say ''
  Say '  ============================================================' 'Green'
  Say '   Share this link with your friends (copied to clipboard):' 'Green'
  Say ''
  Say "   $url" 'Yellow'
  Say ''
  Say "   Admin: open the link, tap 'Login as admin', PIN: $AdminPassword" 'Green'
  Say '  ============================================================' 'Green'
  Say ''
  Say '  Keep this window open. Your PC will stay awake.' 'White'
  Say '  Press Ctrl+C to stop the party.' 'White'
  Say ''

  if ($SmokeTest) { Say 'Smoke test passed, stopping.' 'Cyan'; return }

  while ($true) {
    if ($server.HasExited) { Say "The server stopped unexpectedly. See $logs\server.err.log" 'Red'; break }
    if ($tunnel.HasExited) { Say 'The public link stopped (internet problem?). Run the script again for a new link.' 'Red'; break }
    Start-Sleep -Seconds 3
  }
} finally {
  Say 'Stopping the party...' 'Cyan'
  Stop-Tree $tunnel
  Stop-Tree $server
  [PopQuiz.Power]::SetThreadExecutionState($ES_CONTINUOUS) | Out-Null
  Remove-Item Env:ADMIN_PASSWORD, Env:JWT_SECRET -ErrorAction SilentlyContinue
}

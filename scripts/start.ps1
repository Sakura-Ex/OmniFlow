param(
  [ValidateRange(1, 65535)][int]$FrontendPort = 5173,
  [ValidateRange(1, 65535)][int]$BackendPort = 7998,
  [switch]$NoBrowser,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$ownedProcesses = @()
$previousBackendUrl = $env:VITE_BACKEND_URL
$exitCode = 0

function Assert-PortAvailable([int]$Port) {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  try {
    $listener.Start()
  } catch {
    throw "Port $Port is already in use. Close its existing service or choose another port (see docs/starting.md)."
  } finally {
    $listener.Stop()
  }
}

function Invoke-Checked([string]$Program, [string[]]$Arguments) {
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Program failed (exit $LASTEXITCODE). See its output above."
  }
}

function Wait-Service($Process, [string]$Url, [string]$ExpectedText, [string]$ErrorLog) {
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  while ([DateTime]::UtcNow -lt $deadline) {
    $Process.Refresh()
    if ($Process.HasExited) {
      if (Test-Path -LiteralPath $ErrorLog) { Get-Content -LiteralPath $ErrorLog -Tail 20 | Out-Host }
      throw "Service exited before it was ready: $Url. Logs: $ErrorLog"
    }
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200 -and $response.Content.Contains($ExpectedText)) { return }
    } catch {
      # Connection errors are expected while the service starts.
    }
    Start-Sleep -Milliseconds 300
  }
  throw "Service did not become ready within 45 seconds: $Url. Logs: $ErrorLog"
}

Push-Location $projectRoot
try {
  Write-Host 'OmniFlow - starting frontend and backend' -ForegroundColor Cyan
  if ($FrontendPort -eq $BackendPort) { throw 'FrontendPort and BackendPort must be different.' }

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if (!$nodeCommand) { throw 'Node.js is missing. Install Node.js 22.12+ or 24 LTS, then run start.bat again.' }
  $nodePath = $nodeCommand.Source
  $nodeVersionText = & $nodePath --version
  if ($LASTEXITCODE -ne 0) { throw 'Node.js could not run.' }
  $nodeVersion = [version]$nodeVersionText.Trim().TrimStart('v')
  if (!(($nodeVersion.Major -eq 20 -and $nodeVersion.Minor -ge 19) -or ($nodeVersion.Major -eq 22 -and $nodeVersion.Minor -ge 12) -or $nodeVersion.Major -gt 22)) {
    throw 'Node.js 20.19+ / 22.12+ is required.'
  }

  $pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
  $vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'

  if (!$CheckOnly) {
    Assert-PortAvailable $FrontendPort
    Assert-PortAvailable $BackendPort
  }

  if (!(Test-Path -LiteralPath $vitePath)) {
    if ($CheckOnly) { throw 'Frontend dependencies are missing. Run start.bat to install them.' }
    $npmPath = Join-Path (Split-Path $nodePath -Parent) 'node_modules\npm\bin\npm-cli.js'
    if (!(Test-Path -LiteralPath $npmPath)) { throw 'The Node.js installation has no bundled npm. Repair Node.js and try again.' }
    Write-Host 'Installing frontend dependencies...'
    Invoke-Checked $nodePath @($npmPath, 'ci')
  }

  if (!(Test-Path -LiteralPath $pythonPath)) {
    if ($CheckOnly) { throw 'Python environment .venv is missing. Run start.bat to create it.' }
    $pythonCommand = Get-Command py.exe -ErrorAction SilentlyContinue
    $pythonArgs = @('-3')
    if (!$pythonCommand) {
      $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
      $pythonArgs = @()
    }
    if (!$pythonCommand) { throw 'Python is missing. Install Python 3.11+ and run start.bat again.' }
    Write-Host 'Creating the Python environment...'
    Invoke-Checked $pythonCommand.Source ($pythonArgs + @('-m', 'venv', '.venv'))
  }

  Invoke-Checked $pythonPath @('-c', 'import sys; assert sys.version_info >= (3, 11), ''Python 3.11+ is required. Recreate .venv with a supported Python version.''')
  $dependencyCheck = @'
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
import sys
for line in Path('backend/requirements.txt').read_text().splitlines():
    name, expected = line.split('==')
    try:
        installed = version(name)
    except PackageNotFoundError:
        sys.exit(1)
    if installed != expected:
        sys.exit(1)
'@
  & $pythonPath -c $dependencyCheck
  if ($LASTEXITCODE -ne 0) {
    if ($CheckOnly) { throw 'Backend dependencies need installation. Run start.bat to install them.' }
    Write-Host 'Installing backend dependencies...'
    Invoke-Checked $pythonPath @('-m', 'pip', 'install', '-r', 'backend/requirements.txt')
  }

  if ($CheckOnly) {
    Write-Host 'Environment check passed. Ready to run start.bat.' -ForegroundColor Green
  } else {
    $logDirectory = Join-Path $projectRoot ('logs\start-' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff'))
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $backendUrl = "http://127.0.0.1:$BackendPort"
    $frontendUrl = "http://127.0.0.1:$FrontendPort"
    $backendError = Join-Path $logDirectory 'backend-error.log'
    $frontendError = Join-Path $logDirectory 'frontend-error.log'

    $backend = Start-Process -FilePath $pythonPath -ArgumentList @('-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', "$BackendPort") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'backend.log') -RedirectStandardError $backendError
    $ownedProcesses += $backend
    Wait-Service $backend "$backendUrl/openapi.json" 'OmniFlow Backend' $backendError

    # This child-process override keeps the local pair connected without editing .env files.
    $env:VITE_BACKEND_URL = $backendUrl
    $frontend = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'frontend.log') -RedirectStandardError $frontendError
    $ownedProcesses += $frontend
    Wait-Service $frontend $frontendUrl '<title>OmniFlow</title>' $frontendError

    Write-Host "Ready: $frontendUrl" -ForegroundColor Green
    Write-Host "Backend: $backendUrl"
    Write-Host "Logs: $logDirectory"
    if (!$NoBrowser) { Start-Process $frontendUrl | Out-Null }
    Read-Host 'Press Enter to stop both services (Ctrl+C also stops them)' | Out-Null
  }
} catch {
  Write-Host "Startup failed: $($_.Exception.Message)" -ForegroundColor Red
  $exitCode = 1
} finally {
  foreach ($ownedProcess in $ownedProcesses) {
    $ownedProcess.Refresh()
    if (!$ownedProcess.HasExited) { Stop-Process -Id $ownedProcess.Id -ErrorAction SilentlyContinue }
    $ownedProcess.Dispose()
  }
  $env:VITE_BACKEND_URL = $previousBackendUrl
  Pop-Location
}
exit $exitCode

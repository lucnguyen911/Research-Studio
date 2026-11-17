@echo off
setlocal
set "RS_ROOT=%~dp0"
if "%RS_ROOT:~-1%"=="\" set "RS_ROOT=%RS_ROOT:~0,-1%"
set "RS_ARG1=%~1"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = $env:RS_ROOT; $py = Join-Path $root 'backend\.venv\Scripts\python.exe'; if (-not (Test-Path $py)) { Write-Host '[ERROR] Missing backend\.venv\Scripts\python.exe'; exit 1 }; $feDir = Join-Path $root 'frontend'; $viteJs = Join-Path $feDir 'node_modules\vite\bin\vite.js'; if (-not (Test-Path $viteJs)) { Write-Host '[ERROR] Missing frontend\node_modules\vite\bin\vite.js'; exit 1 }; $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue; if (-not $nodeCmd) { Write-Host '[ERROR] node.exe not found in PATH'; exit 1 }; $nodeExe = $nodeCmd.Source; $logDir = Join-Path $env:LOCALAPPDATA 'ResearchStudio\logs'; New-Item -ItemType Directory -Force -Path $logDir | Out-Null; $beUp = [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue); if (-not $beUp) { Write-Host 'Starting Backend (127.0.0.1:8000)...'; Start-Process -FilePath $py -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--log-level','warning' -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'backend-stdout.log') -RedirectStandardError (Join-Path $logDir 'backend-stderr.log') } else { Write-Host 'Backend is already running on 127.0.0.1:8000.' }; $feUp = [bool](Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue); if (-not $feUp) { Write-Host 'Starting Frontend (127.0.0.1:5173)...'; Start-Process -FilePath $nodeExe -ArgumentList 'node_modules\vite\bin\vite.js','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory $feDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'frontend-stdout.log') -RedirectStandardError (Join-Path $logDir 'frontend-stderr.log') } else { Write-Host 'Frontend is already running on 127.0.0.1:5173.' }; $ok = $false; for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 500; try { $h = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; $f = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:5173/' -TimeoutSec 2; if ($h.StatusCode -eq 200 -and $f.StatusCode -eq 200) { $ok = $true; break } } catch {} }; if ($ok) { $url = 'http://127.0.0.1:5173/#/global/overview'; Write-Host ('Research Studio is ready at ' + $url); if ($env:RS_ARG1 -ne '--no-browser') { Start-Process $url } } else { Write-Host ('[WARNING] Servers did not become ready in time. Check logs in ' + $logDir); exit 1 }"
if errorlevel 1 (
  if /I not "%RS_ARG1%"=="--no-browser" pause
  endlocal
  exit /b 1
)

endlocal
exit /b 0

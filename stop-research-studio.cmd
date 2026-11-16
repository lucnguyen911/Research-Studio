@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(8000, 5173); $pids = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if (-not $pids) { Write-Host 'Khong co tien trinh Research Studio nao dang chay.'; exit 0 }; foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Host ('Da dung PID ' + $p) }"
endlocal

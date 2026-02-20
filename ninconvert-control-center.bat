@echo off
if not defined WCC_BOOTSTRAP (
  set "WCC_BOOTSTRAP=1"
  cmd /E:ON /V:ON /C ""%~f0" %*"
  exit /b %errorlevel%
)
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

title Website Control Center

set "PROJECT_ROOT=C:\Users\Jay\Documents\Website"
set "BACKEND_ROOT=C:\WebsiteBackend\backend"
set "TMP_ROOT=%BACKEND_ROOT%\tmp"
set "STATE_DIR=%BACKEND_ROOT%\run"
set "LOG_DIR=%BACKEND_ROOT%\logs"
set "API_CONFIG=%PROJECT_ROOT%\public\assets\config\ninconvert-api.json"
set "LOCALHOST_DEFAULT_URL=http://localhost:5173/"
set "LOCALHOST_ALT_URL=http://localhost:4173/"

set "LOCALHOST_PID_FILE=%STATE_DIR%\localhost.pid"
set "LOCALHOST_START_FILE=%STATE_DIR%\localhost-start.txt"
set "LOCAL_BACKEND_PID_FILE=%STATE_DIR%\local-backend.pid"
set "LOCAL_BACKEND_START_FILE=%STATE_DIR%\local-backend-start.txt"
set "TUNNEL_PID_FILE=%STATE_DIR%\tunnel.pid"
set "TUNNEL_URL_FILE=%STATE_DIR%\tunnel-url.txt"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "BACKEND_ERR_LOG=%LOG_DIR%\backend.err.log"
set "TUNNEL_LOG=%LOG_DIR%\cloudflare.log"
set "TUNNEL_ERR_LOG=%LOG_DIR%\cloudflare.err.log"

if not exist "%STATE_DIR%" mkdir "%STATE_DIR%" >nul 2>nul
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul

if /I "%~1"=="--logs-window" goto logs_window

:menu
cls
call :rs

echo ==========================================================
echo                     WEBSITE CONTROL
echo ==========================================================

if /I "%LOCAL_BACKEND_OK%"=="1" (
  powershell -NoProfile -Command "Write-Host 'Status local backend: ACTIF / FONCTIONNEL' -ForegroundColor Green"
) else (
  powershell -NoProfile -Command "Write-Host 'Status local backend: INACTIF / NON FONCTIONNEL' -ForegroundColor Red"
)

if /I "%LOCALHOST_OK%"=="1" (
  powershell -NoProfile -Command "Write-Host 'Status localhost (node.js): ACTIF / DISPONIBLE' -ForegroundColor Green"
) else (
  powershell -NoProfile -Command "Write-Host 'Status localhost (node.js): INACTIF / INDISPONIBLE' -ForegroundColor Red"
)

echo Uptime backend: %LOCAL_BACKEND_UPTIME%

if defined CF_URL (
  powershell -NoProfile -Command "Write-Host 'Cloudflare URL: %CF_URL%' -ForegroundColor Cyan"
) else (
  powershell -NoProfile -Command "Write-Host 'Cloudflare URL: non detectee' -ForegroundColor DarkGray"
)

echo.
echo [1] Start NinConvert ^(backend + tunnel^)
echo [2] Show log info
echo [3] Delete temp files
echo [4] Stop NinConvert and delete temp files
echo [5] Refresh status
echo [6] Start localhost ^(start-local.bat^)
echo [7] Open localhost in browser
echo [8] Stop localhost
echo [9] Start local backend ^(start-ninconvert-backend.bat^)
echo [A] Stop local backend
echo [0] Quitter
echo.
set /p CHOICE=Choisis une option: 

if /I "%CHOICE%"=="1" goto start_all
if /I "%CHOICE%"=="2" goto show_logs
if /I "%CHOICE%"=="3" goto purge_only
if /I "%CHOICE%"=="4" goto stop_and_purge
if /I "%CHOICE%"=="5" goto menu
if /I "%CHOICE%"=="6" goto start_localhost
if /I "%CHOICE%"=="7" goto open_localhost
if /I "%CHOICE%"=="8" goto stop_localhost_action
if /I "%CHOICE%"=="9" goto start_local_backend_action
if /I "%CHOICE%"=="A" goto stop_local_backend_action
if /I "%CHOICE%"=="0" goto end

echo.
echo Option invalide.
call :wait_enter
goto menu

:start_all
call :start_local_backend
call :start_tunnel
echo.
echo Start NinConvert termine.
call :wait_enter
goto menu

:show_logs
call :ensure_file "%BACKEND_LOG%"
call :ensure_file "%TUNNEL_LOG%"
start "Website Logs" /wait "%~f0" --logs-window
goto menu

:logs_window
cls
title Website Logs
echo ==========================================================
echo                        WEBSITE LOGS
echo ==========================================================
echo.
echo [Backend log] %BACKEND_LOG%
if exist "%BACKEND_LOG%" (
  powershell -NoProfile -Command "Write-Host '----- Last backend lines -----' -ForegroundColor Cyan; Get-Content -Path '%BACKEND_LOG%' -Tail 60"
) else (
  echo Backend log introuvable.
)
echo.
echo [Tunnel log] %TUNNEL_LOG%
if exist "%TUNNEL_LOG%" (
  powershell -NoProfile -Command "Write-Host '----- Last tunnel lines -----' -ForegroundColor Cyan; Get-Content -Path '%TUNNEL_LOG%' -Tail 60"
) else (
  echo Tunnel log introuvable.
)
echo.
set /p _LOG_BACK=Press Enter to go back to the menu...
exit /b 0

:purge_only
call :purge_temp
echo.
echo Temp files supprimes.
call :wait_enter
goto menu

:stop_and_purge
call :stop_local_backend
call :stop_tunnel
call :stop_localhost
call :purge_temp
echo.
echo NinConvert stoppe et temp files supprimes.
call :wait_enter
goto menu

:start_localhost
call :is_pid_running "%LOCALHOST_PID_FILE%" RUNNING
if /I "%RUNNING%"=="1" (
  echo.
  echo Localhost est deja en cours.
  call :wait_enter
  goto menu
)

if not exist "%PROJECT_ROOT%\start-local.bat" (
  echo.
  echo ERREUR: fichier introuvable: %PROJECT_ROOT%\start-local.bat
  call :wait_enter
  goto menu
)

powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','\"%PROJECT_ROOT%\start-local.bat\"' -WorkingDirectory '%PROJECT_ROOT%' -WindowStyle Hidden -PassThru; Set-Content -Path '%LOCALHOST_PID_FILE%' -Value $p.Id -NoNewline; Set-Content -Path '%LOCALHOST_START_FILE%' -Value (Get-Date).ToString('o') -NoNewline"
timeout /t 2 >nul
echo.
echo Start localhost lance.
call :wait_enter
goto menu

:open_localhost
call :rs
if /I "%LOCALHOST_OK%"=="1" (
  start "" "%LOCALHOST_URL%"
  echo.
  echo Localhost ouvert: %LOCALHOST_URL%
) else (
  echo.
  echo Localhost indisponible.
  echo Lance d'abord l'option [6], puis reessaie.
)
call :wait_enter
goto menu

:stop_localhost_action
call :stop_localhost
echo.
echo Localhost stoppe.
call :wait_enter
goto menu

:start_local_backend_action
call :start_local_backend
echo.
echo Start local backend termine.
call :wait_enter
goto menu

:stop_local_backend_action
call :stop_local_backend
echo.
echo Local backend stoppe.
call :wait_enter
goto menu

:rs
set "LOCAL_BACKEND_OK=0"
set "LOCAL_BACKEND_UPTIME=N/A"
set "LOCALHOST_OK=0"
set "LOCALHOST_URL=%LOCALHOST_DEFAULT_URL%"
set "CF_URL="

for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; try { $r = Invoke-RestMethod -Uri 'http://localhost:8787/health' -TimeoutSec 2; if($r.ok -eq $true){'1'} else {'0'} } catch {'0'}"`) do set "LOCAL_BACKEND_OK=%%U"

if exist "%LOCAL_BACKEND_START_FILE%" if "%LOCAL_BACKEND_OK%"=="1" (
  for /f "usebackq delims=" %%T in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; try { $s = Get-Content -Path '%LOCAL_BACKEND_START_FILE%' -Raw; $st=[datetime]$s; $d=(Get-Date)-$st; '{0:00}h {1:00}m {2:00}s' -f [int]$d.TotalHours,$d.Minutes,$d.Seconds } catch { 'N/A' }"`) do set "LOCAL_BACKEND_UPTIME=%%T"
)

for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; function Test-Url([string]$u){ try { $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; return $r.StatusCode -ge 200 -and $r.StatusCode -lt 500 } catch { return $false } }; if(Test-Url '%LOCALHOST_DEFAULT_URL%'){ '1|%LOCALHOST_DEFAULT_URL%' } elseif(Test-Url '%LOCALHOST_ALT_URL%'){ '1|%LOCALHOST_ALT_URL%' } else { '0|%LOCALHOST_DEFAULT_URL%' }"`) do (
  for /f "tokens=1,2 delims=|" %%A in ("%%U") do (
    set "LOCALHOST_OK=%%A"
    set "LOCALHOST_URL=%%B"
  )
)

if exist "%TUNNEL_URL_FILE%" (
  set /p CF_URL=<"%TUNNEL_URL_FILE%"
)
if not defined CF_URL if exist "%API_CONFIG%" (
  for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; try { (Get-Content -Raw '%API_CONFIG%' | ConvertFrom-Json).apiBaseUrl } catch { '' }"`) do set "CF_URL=%%U"
)
exit /b 0

:start_local_backend
call :is_pid_running "%LOCAL_BACKEND_PID_FILE%" RUNNING
if /I "%RUNNING%"=="1" (
  echo Local backend deja en cours.
  exit /b 0
)

if not exist "%PROJECT_ROOT%\start-ninconvert-backend.bat" (
  echo ERREUR: fichier introuvable: %PROJECT_ROOT%\start-ninconvert-backend.bat
  exit /b 1
)

powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','\"%PROJECT_ROOT%\start-ninconvert-backend.bat\"' -WorkingDirectory '%PROJECT_ROOT%' -WindowStyle Hidden -PassThru; Set-Content -Path '%LOCAL_BACKEND_PID_FILE%' -Value $p.Id -NoNewline; Set-Content -Path '%LOCAL_BACKEND_START_FILE%' -Value (Get-Date).ToString('o') -NoNewline"
timeout /t 2 >nul
exit /b 0

:start_tunnel
call :is_pid_running "%TUNNEL_PID_FILE%" RUNNING
if /I "%RUNNING%"=="1" (
  echo Tunnel deja en cours.
  exit /b 0
)

set "CF_BIN="
for /f "delims=" %%B in ('where cloudflared 2^>nul') do (
  set "CF_BIN=%%B"
  goto :cf_found
)
if not defined CF_BIN if exist "C:\Users\Jay\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe" (
  set "CF_BIN=C:\Users\Jay\AppData\Local\Microsoft\WinGet\Packages\Cloudflare.cloudflared_Microsoft.Winget.Source_8wekyb3d8bbwe\cloudflared.exe"
)

:cf_found
if not defined CF_BIN (
  echo AVERTISSEMENT: cloudflared introuvable. Tunnel non lance.
  exit /b 0
)

powershell -NoProfile -Command "$p = Start-Process -FilePath '%CF_BIN%' -ArgumentList 'tunnel','--url','http://localhost:8787','--no-autoupdate' -WorkingDirectory '%BACKEND_ROOT%' -WindowStyle Hidden -RedirectStandardOutput '%TUNNEL_LOG%' -RedirectStandardError '%TUNNEL_ERR_LOG%' -PassThru; Set-Content -Path '%TUNNEL_PID_FILE%' -Value $p.Id -NoNewline"
timeout /t 3 >nul
for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$ErrorActionPreference='SilentlyContinue'; if(Test-Path '%TUNNEL_LOG%'){ $m = [regex]::Match((Get-Content -Path '%TUNNEL_LOG%' -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com'); if($m.Success){$m.Value}}"`) do set "FOUND_URL=%%U"
if defined FOUND_URL >"%TUNNEL_URL_FILE%" echo %FOUND_URL%
exit /b 0

:stop_local_backend
call :stop_by_pid_file "%LOCAL_BACKEND_PID_FILE%"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8787 .*LISTENING"') do (
  taskkill /PID %%P /F >nul 2>nul
)
if exist "%LOCAL_BACKEND_START_FILE%" del /f /q "%LOCAL_BACKEND_START_FILE%" >nul 2>nul
exit /b 0

:stop_tunnel
call :stop_by_pid_file "%TUNNEL_PID_FILE%"
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV /NH ^| findstr /I "cloudflared.exe"') do (
  taskkill /PID %%~P /F >nul 2>nul
)
if exist "%TUNNEL_URL_FILE%" del /f /q "%TUNNEL_URL_FILE%" >nul 2>nul
exit /b 0

:stop_localhost
call :stop_by_pid_file "%LOCALHOST_PID_FILE%"
for %%PORT in (5173 4173) do (
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%%PORT .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>nul
  )
)
if exist "%LOCALHOST_START_FILE%" del /f /q "%LOCALHOST_START_FILE%" >nul 2>nul
exit /b 0

:stop_by_pid_file
set "PID_FILE=%~1"
if not exist "%PID_FILE%" exit /b 0
set "PID_VALUE="
set /p PID_VALUE=<"%PID_FILE%"
if defined PID_VALUE taskkill /PID %PID_VALUE% /F >nul 2>nul
del /f /q "%PID_FILE%" >nul 2>nul
exit /b 0

:is_pid_running
set "PID_FILE=%~1"
set "RESULT_VAR=%~2"
set "%RESULT_VAR%=0"
if not exist "%PID_FILE%" exit /b 0
set "PID_VALUE="
set /p PID_VALUE=<"%PID_FILE%"
if not defined PID_VALUE exit /b 0
for /f "delims=" %%R in ('tasklist /FI "PID eq %PID_VALUE%" /NH ^| findstr /V /I "Aucune tache" ^| findstr /V /I "No tasks"') do set "%RESULT_VAR%=1"
exit /b 0

:purge_temp
if not exist "%TMP_ROOT%" exit /b 0
for %%D in ("%TMP_ROOT%\incoming" "%TMP_ROOT%\work" "%TMP_ROOT%\final") do (
  if exist "%%~D" del /f /q "%%~D\*" >nul 2>nul
)
exit /b 0

:ensure_file
set "FP=%~1"
if not exist "%FP%" type nul > "%FP%"
exit /b 0

:wait_enter
echo.
set /p _GO=Press Enter to go back to the menu...
exit /b 0

:end
endlocal
exit /b 0

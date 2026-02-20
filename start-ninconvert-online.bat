@echo off
setlocal EnableExtensions EnableDelayedExpansion

title NinConvert Online (Backend + Cloudflare Tunnel + Optional GitHub Update)

set "ROOT=%~dp0"
set "BACKEND_BAT=%ROOT%start-ninconvert-backend.bat"
set "CONFIG_FILE=%ROOT%public\assets\config\ninconvert-api.json"
set "LOG_FILE=%TEMP%\ninconvert-tunnel.log"
set "TUNNEL_URL="
set "DO_GITHUB_UPDATE="

if not exist "%BACKEND_BAT%" (
  echo ERREUR: start-ninconvert-backend.bat introuvable.
  echo Chemin attendu: %BACKEND_BAT%
  echo.
  echo Appuie sur une touche pour fermer.
  pause >nul
  exit /b 1
)

set "CF_BIN="
where cloudflared >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%P in ('where cloudflared') do (
    set "CF_BIN=%%P"
    goto :cf_found
  )
)

for /d %%D in ("%LOCALAPPDATA%\Microsoft\WinGet\Packages\Cloudflare.cloudflared_*") do (
  if exist "%%D\cloudflared.exe" (
    set "CF_BIN=%%D\cloudflared.exe"
    goto :cf_found
  )
)

if exist "C:\Program Files\cloudflared\cloudflared.exe" set "CF_BIN=C:\Program Files\cloudflared\cloudflared.exe"
if exist "C:\Program Files\Cloudflare\Cloudflared\cloudflared.exe" set "CF_BIN=C:\Program Files\Cloudflare\Cloudflared\cloudflared.exe"

:cf_found
if "%CF_BIN%"=="" (
  echo ERREUR: cloudflared introuvable.
  echo Installe-le via winget puis relance:
  echo winget install Cloudflare.cloudflared
  echo.
  echo Appuie sur une touche pour fermer.
  pause >nul
  exit /b 1
)

echo [1/3] Cloudflared detecte:
echo %CF_BIN%
"%CF_BIN%" --version
if errorlevel 1 (
  echo ERREUR: impossible d'executer cloudflared.
  echo Appuie sur une touche pour fermer.
  pause >nul
  exit /b 1
)
echo.

echo [2/3] Demarrage backend NinConvert dans une nouvelle fenetre...
start "NinConvert Backend" cmd /k ""%BACKEND_BAT%""

echo Attente du backend sur http://localhost:8787/health ...
set "READY=0"
for /l %%I in (1,1,30) do (
  curl -sS http://localhost:8787/health >nul 2>nul
  if not errorlevel 1 (
    set "READY=1"
    goto :backend_ready
  )
  timeout /t 1 >nul
)

:backend_ready
if "%READY%"=="1" (
  echo Backend pret.
) else (
  echo ATTENTION: backend non detecte apres 30s.
  echo Le tunnel va quand meme se lancer.
)
echo.

echo [3/3] Lancement Cloudflare Tunnel temporaire (sans domaine)...
echo URL backend local:  http://localhost:8787
echo URL publique:       detection automatique de "https://...trycloudflare.com"
echo.

if exist "%LOG_FILE%" del /f /q "%LOG_FILE%" >nul 2>nul
start "NinConvert Tunnel" cmd /c ""%CF_BIN%" tunnel --url http://localhost:8787 > "%LOG_FILE%" 2>&1"

echo Attente URL trycloudflare...
for /l %%I in (1,1,90) do (
  for /f "delims=" %%U in ('powershell -NoProfile -Command "$p='%LOG_FILE%'; if (Test-Path $p) { $m=[regex]::Match((Get-Content $p -Raw), 'https://[a-zA-Z0-9.-]+trycloudflare.com'); if($m.Success){$m.Value} }"') do (
    set "TUNNEL_URL=%%U"
  )
  if defined TUNNEL_URL goto :url_ready
  timeout /t 1 >nul
)

echo ERREUR: URL Cloudflare non detectee.
echo Consulte le log: %LOG_FILE%
echo.
echo Appuie sur une touche pour fermer.
pause >nul
exit /b 1

:url_ready
echo URL detectee: %TUNNEL_URL%
echo.

if exist "%CONFIG_FILE%" (
  powershell -NoProfile -Command "$path='%CONFIG_FILE%'; $url='%TUNNEL_URL%'; $json = @{ apiBaseUrl=$url; updatedAt=(Get-Date).ToString('o') } | ConvertTo-Json; Set-Content -Path $path -Value $json -Encoding UTF8"
  echo Fichier config mis a jour: %CONFIG_FILE%
) else (
  echo ATTENTION: config introuvable, mise a jour fichier ignoree.
  echo Chemin attendu: %CONFIG_FILE%
)

echo.
set /p DO_GITHUB_UPDATE=Mettre a jour GitHub (commit/push URL API) ? [O/N]:
if /i "%DO_GITHUB_UPDATE%"=="O" goto :do_git
if /i "%DO_GITHUB_UPDATE%"=="Y" goto :do_git
goto :skip_git

:do_git
cd /d "%ROOT%"
git add "%CONFIG_FILE%" >nul 2>nul
git diff --cached --quiet -- "%CONFIG_FILE%"
if errorlevel 1 (
  git commit -m "chore: update ninconvert API endpoint"
  if errorlevel 1 (
    echo Commit echoue.
    goto :after_git
  )
  git push origin main
  if errorlevel 1 (
    echo Push echoue.
    goto :after_git
  )
  echo Push termine.
) else (
  echo Aucun changement detecte, pas de commit.
)
goto :after_git

:skip_git
echo Update GitHub ignoree.

:after_git
set "EXIT_CODE=0"

echo.
echo Le tunnel tourne dans la fenetre "NinConvert Tunnel".
echo Arret tunnel: ferme la fenetre "NinConvert Tunnel" ou Ctrl + C dedans.
echo Appuie sur une touche pour fermer.
pause >nul
exit /b %EXIT_CODE%

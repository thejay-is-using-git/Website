@echo off
setlocal EnableExtensions
chcp 65001 >nul
title NinConvert Backend Logs

set "BACKEND_ROOT=C:\WebsiteBackend\backend"

cd /d "%BACKEND_ROOT%"
if errorlevel 1 (
  echo ERREUR: dossier backend introuvable.
  echo Chemin attendu: C:\WebsiteBackend\backend
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Node.js n'est pas installe ou pas dans le PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERREUR: npm n'est pas disponible dans le PATH.
  pause
  exit /b 1
)

echo [NinConvert] Backend logs en direct
echo API    : http://localhost:8787/
echo Health : http://localhost:8787/health
echo.
echo Tu verras:
echo - START: nom du fichier et format
echo - STEP : normalisation / loop / encodage
echo - DONE : taille sortie + temps total
echo.
echo Arret: Ctrl + C
echo.

if not exist "node_modules" (
  echo Installation des dependances...
  call npm install || (
    echo ERREUR: npm install a echoue.
    pause
    exit /b 1
  )
)

set "PORT_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8787 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :kill_port
)
goto :run_backend

:kill_port
if defined PORT_PID (
  echo Port 8787 deja utilise - PID %PORT_PID% - fermeture de l'ancien process...
  taskkill /PID %PORT_PID% /F >nul 2>nul
  timeout /t 1 >nul
)

:run_backend
call npm run start
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo ERREUR: backend arrete avec le code %EXIT_CODE%.
) else (
  echo Backend arrete.
)
pause
exit /b %EXIT_CODE%

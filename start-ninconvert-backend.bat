@echo off
setlocal EnableExtensions
title NinConvert Backend - Local Dev

set "BACKEND_ROOT=C:\WebsiteBackend\backend"

cd /d "%BACKEND_ROOT%"
if errorlevel 1 (
  echo ERREUR: dossier backend introuvable.
  echo Chemin attendu: C:\WebsiteBackend\backend
  echo Appuie sur une touche pour fermer.
  pause >nul
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Node.js n'est pas installe ou pas dans le PATH.
  echo Installe Node.js LTS: https://nodejs.org
  echo Appuie sur une touche pour fermer.
  pause >nul
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERREUR: npm n'est pas disponible dans le PATH.
  echo Reinstalle Node.js LTS: https://nodejs.org
  echo Appuie sur une touche pour fermer.
  pause >nul
  exit /b 1
)

echo [1/3] Node.js detecte:
node -v
echo [1/3] npm detecte:
call npm -v
echo.

if not exist "node_modules" (
  echo [2/3] Installation des dependances backend...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERREUR: npm install a echoue.
    echo Appuie sur une touche pour fermer.
    pause >nul
    exit /b 1
  )
) else (
  echo [2/3] Dependances backend deja installees.
)
echo.

echo [3/3] Demarrage backend NinConvert...
echo URL API: http://localhost:8787/
echo Health : http://localhost:8787/health
echo Arret: Ctrl + C
echo.

set "PORT_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8787 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :kill_port
)
goto :run_backend

:kill_port
if defined PORT_PID (
  echo Port 8787 deja utilise (PID %PORT_PID%), arret de l'ancien process...
  taskkill /PID %PORT_PID% /F >nul 2>nul
  timeout /t 1 >nul
)

:run_backend
call npm run start
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo ERREUR: le backend s'est arrete avec le code %EXIT_CODE%.
) else (
  echo Le backend s'est arrete.
)
echo Appuie sur une touche pour fermer.
pause >nul
exit /b %EXIT_CODE%

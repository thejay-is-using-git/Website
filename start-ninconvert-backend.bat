@echo off
setlocal

cd /d "%~dp0\backend"
title NinConvert Backend - Local Dev

where node >nul 2>nul
if errorlevel 1 goto no_node

where npm >nul 2>nul
if errorlevel 1 goto no_npm

echo [1/3] Node.js detecte:
node -v
echo [1/3] npm detecte:
call npm -v
echo.

if not exist "node_modules" (
  echo [2/3] Installation des dependances backend...
  call npm install
  if errorlevel 1 goto npm_fail
) else (
  echo [2/3] Dependances backend deja installees.
)
echo.

echo [3/3] Demarrage backend NinConvert...
echo URL API: http://localhost:8787/
echo Health : http://localhost:8787/health
echo Arret: Ctrl + C
echo.
call npm run dev
if errorlevel 1 goto dev_fail
echo.
echo Le backend s'est arrete.
echo Appuie sur une touche pour fermer.
pause >nul
goto end

:no_node
echo ERREUR: Node.js n'est pas installe ou pas dans le PATH.
echo Installe Node.js LTS: https://nodejs.org
echo.
echo Appuie sur une touche pour fermer.
pause >nul
exit /b 1

:no_npm
echo ERREUR: npm n'est pas disponible dans le PATH.
echo Reinstalle Node.js LTS: https://nodejs.org
echo.
echo Appuie sur une touche pour fermer.
pause >nul
exit /b 1

:npm_fail
echo.
echo ERREUR: npm install a echoue.
echo.
echo Appuie sur une touche pour fermer.
pause >nul
exit /b 1

:dev_fail
echo.
echo ERREUR: npm run dev a echoue.
echo.
echo Appuie sur une touche pour fermer.
pause >nul
exit /b 1

:end
endlocal

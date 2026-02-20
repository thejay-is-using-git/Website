@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Purge NinConvert Temp

set "TMP_ROOT=C:\WebsiteBackend\backend\tmp"
set "INCOMING_DIR=%TMP_ROOT%\incoming"
set "WORK_DIR=%TMP_ROOT%\work"
set "FINAL_DIR=%TMP_ROOT%\final"

echo [NinConvert] Purge manuelle des fichiers temporaires
if not exist "%TMP_ROOT%" (
  echo Dossier introuvable: %TMP_ROOT%
  pause
  exit /b 1
)

echo.
echo Dossiers cibles:
echo - %INCOMING_DIR%
echo - %WORK_DIR%
echo - %FINAL_DIR%
echo.

set /p CONFIRM=Supprimer tous les fichiers temporaires maintenant ? (O/N): 
if /I not "%CONFIRM%"=="O" if /I not "%CONFIRM%"=="Y" (
  echo Annule.
  pause
  exit /b 0
)

call :clear_dir "%INCOMING_DIR%"
call :clear_dir "%WORK_DIR%"
call :clear_dir "%FINAL_DIR%"

echo.
echo Purge terminee.
pause
exit /b 0

:clear_dir
set "TARGET=%~1"
if not exist "%TARGET%" (
  echo [OK] %TARGET% (absent)
  goto :eof
)

for /f %%C in ('dir /a-d /b "%TARGET%" ^| find /c /v ""') do set "COUNT=%%C"
del /f /q "%TARGET%\*" >nul 2>nul
for /f %%R in ('dir /a-d /b "%TARGET%" ^| find /c /v ""') do set "REMAIN=%%R"

echo [OK] %TARGET% - supprimes: %COUNT% - restants: %REMAIN%
goto :eof

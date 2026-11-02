@echo off
chcp 65001 >nul
rem Doble clic en Windows para abrir Mis Finanzas.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Necesitas instalar Node.js ^(version LTS^). Se abrira la web de descarga.
  echo Cuando termines de instalarlo, vuelve a hacer doble clic en este archivo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

node scripts\start.mjs
pause

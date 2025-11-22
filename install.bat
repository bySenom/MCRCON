@echo off
title Minecraft Server Manager - Installer
color 0B

echo ========================================
echo   Minecraft Server Manager - Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] Node.js ist nicht installiert!
    echo.
    echo Bitte installiere Node.js von: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/4] Node.js gefunden: 
node --version
echo.

REM Check if npm is available
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [FEHLER] npm ist nicht verfuegbar!
    pause
    exit /b 1
)

echo [2/4] npm gefunden:
npm --version
echo.

REM Check if package.json exists
if not exist package.json (
    echo [FEHLER] package.json nicht gefunden!
    echo Bitte fuehre install.bat im Hauptverzeichnis aus.
    echo.
    pause
    exit /b 1
)

REM Install dependencies
echo [3/4] Installiere Abhaengigkeiten...
echo Dies kann einige Minuten dauern...
echo.
npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FEHLER] Installation fehlgeschlagen!
    echo.
    pause
    exit /b 1
)

echo.
echo [4/4] Erstelle .env Datei...
if not exist .env (
    (
        echo PORT=3000
        echo NODE_ENV=production
        echo JWT_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
    ) > .env
    echo .env Datei erstellt!
) else (
    echo .env Datei existiert bereits
)

echo.
echo ========================================
echo   Installation abgeschlossen!
echo ========================================
echo.
echo Starte den Server mit: npm start
echo Oder verwende: start.bat
echo.
echo Der Setup-Wizard oeffnet sich beim ersten Start automatisch!
echo.
pause

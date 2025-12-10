<<<<<<< HEAD
@echo off
echo Starting Local Web Server...
echo.
echo This script attempts to start a local server using Python.
echo If successful, it will open the application in your default browser.
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python found. Starting server on port 8000...
    start http://localhost:8000
    python -m http.server 8000
    pause
    exit
)

:: Check for Python (py launcher)
py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python (py) found. Starting server on port 8000...
    start http://localhost:8000
    py -m http.server 8000
    pause
    exit
)

echo.
echo [ERROR] Python was not found on your system.
echo Please install Python or use VS Code's "Live Server" extension.
echo.
pause
=======
@echo off
echo Starting Local Web Server...
echo.
echo This script attempts to start a local server using Python.
echo If successful, it will open the application in your default browser.
echo.

:: Check for Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python found. Starting server on port 8000...
    start http://localhost:8000
    python -m http.server 8000
    pause
    exit
)

:: Check for Python (py launcher)
py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python (py) found. Starting server on port 8000...
    start http://localhost:8000
    py -m http.server 8000
    pause
    exit
)

echo.
echo [ERROR] Python was not found on your system.
echo Please install Python or use VS Code's "Live Server" extension.
echo.
pause
>>>>>>> 69958a1430fa59ef7d54047e968a915e3f18feb4

@echo off
REM NutriLens - one-click start (Windows)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required ^(v18 or newer; v22.5+ is easiest^). Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo - Installing server dependencies ^(first run only^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   The optional native SQLite module could not be built ^(no C++ toolchain^).
    echo   Retrying without it - Node 22.5+ has SQLite built in, so this is fine.
    echo.
    call npm install --no-audit --no-fund --omit=optional
  )
)

if not exist client\dist\index.html (
  echo - Building the React client...
  call npm run build
)

set PORT=4000
echo.
echo   NutriLens is starting -^> http://localhost:%PORT%
echo   Demo login: demo@nutrilens.app / demo1234
echo   Keep this window open. Close it or press Ctrl+C to stop the app.
echo.

REM open the browser only once the server is actually accepting connections
start "" powershell -NoProfile -WindowStyle Hidden -Command ^
  "for($i=0;$i -lt 120;$i++){try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',%PORT%);$t.Close();Start-Process 'http://localhost:%PORT%';break}catch{Start-Sleep -Milliseconds 500}}"

call npm start
echo.
echo   The server stopped. If that was unexpected, run:  npm run doctor
pause

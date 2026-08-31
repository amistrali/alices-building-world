@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo   Alice's Building World - creazione icona
echo ==========================================================
echo.
echo Incolla l'indirizzo dell'app pubblicata su Vercel
echo (esempio: https://alices-building-world.vercel.app)
echo.
set /p APPURL=Indirizzo:

if "%APPURL%"=="" (
  echo Nessun indirizzo inserito. Esco.
  pause
  exit /b 1
)

set "ICON=%~dp0app-icon.ico"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = '%APPURL%';" ^
  "$icon = '%ICON%';" ^
  "$chrome = @('C:\Program Files\Google\Chrome\Application\chrome.exe','C:\Program Files (x86)\Google\Chrome\Application\chrome.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "$edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe','C:\Program Files\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "$browser = if ($chrome) { $chrome } else { $edge };" ^
  "if (-not $browser) { Write-Host 'Nessun browser trovato.'; exit 1 };" ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "foreach ($dir in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {" ^
  "  $lnk = $ws.CreateShortcut((Join-Path $dir 'Alice''s Building World.lnk'));" ^
  "  $lnk.TargetPath = $browser;" ^
  "  $lnk.Arguments = '--app=' + $url;" ^
  "  $lnk.IconLocation = $icon + ',0';" ^
  "  $lnk.Description = 'Alice''s Building World';" ^
  "  $lnk.WorkingDirectory = Split-Path $browser;" ^
  "  $lnk.Save();" ^
  "  Write-Host ('Creato: ' + $dir) };" ^
  "Write-Host ('Browser usato: ' + $browser)"

echo.
echo ==========================================================
echo   FATTO.
echo.
echo   Trovi "Alice's Building World" sul Desktop e nel menu Start.
echo   L'app si apre in una finestra pulita, senza barre del browser.
echo.
echo   Per metterla sulla barra delle applicazioni:
echo     tasto destro sull'icona  -^>  "Aggiungi alla barra
echo     delle applicazioni"
echo   (su Windows 11 potrebbe essere sotto "Altre opzioni")
echo ==========================================================
pause

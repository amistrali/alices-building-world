@echo off
cd /d "%~dp0"

echo === 1/3 Installo le dipendenze (puo' richiedere qualche minuto) ===
call npm install
if errorlevel 1 goto fallito

echo.
echo === 2/3 Build di prova con CI=true (la stessa che fa Vercel) ===
set CI=true
call npm run build
if errorlevel 1 goto fallito

echo.
echo === 3/3 Inizializzo il repository git ===
if exist ".git" (
  echo Repository gia' presente, salto.
) else (
  git init
  git branch -M main
  git add -A
  git commit -m "Alice's Building World - primo commit"
)

echo.
echo ===============================================
echo  FATTO. Ora, una volta sola:
echo.
echo  1. Crea un repository vuoto su GitHub chiamato
echo     alices-building-world
echo  2. Collegalo e fai il push:
echo       git remote add origin https://github.com/TUO-UTENTE/alices-building-world.git
echo       git push -u origin main
echo  3. Su Vercel: Add New Project - importa il repo
echo  4. Su Vercel, Settings - Environment Variables, aggiungi:
echo       ANTHROPIC_KEY     = la stessa di meal-prep-app
echo       YOUTUBE_API_KEY   = la stessa di meal-prep-app
echo.
echo  Da qui in poi usa build-and-deploy.bat "messaggio"
echo ===============================================
goto fine

:fallito
echo.
echo *** QUALCOSA E' ANDATO STORTO: leggi l'errore qui sopra. ***

:fine
pause

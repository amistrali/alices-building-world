@echo off
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=aggiornamento"

set CI=true
echo === BUILD (CI=true, come Vercel) === > build-log.txt
call npm run build >> build-log.txt 2>&1
if errorlevel 1 goto fallito

echo. >> build-log.txt
echo === BUILD OK, procedo con commit e push === >> build-log.txt
git add -A >> build-log.txt 2>&1
git commit -m "%MSG%" >> build-log.txt 2>&1
git push origin main >> build-log.txt 2>&1
git log --oneline -2 >> build-log.txt 2>&1
echo ESITO=PUSH_FATTO >> build-log.txt
goto fine

:fallito
echo. >> build-log.txt
echo ESITO=BUILD_FALLITO - nessun push eseguito >> build-log.txt

:fine
echo === FINE === >> build-log.txt
type build-log.txt

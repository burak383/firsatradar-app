@echo off
REM FirsatRadar backend sunucusunu baslatir.
REM run_hidden.vbs araciligiyla penceresiz calistirilir; bu yuzden TUM
REM ciktiyi (hem normal loglar hem hatalar) backend_log.txt dosyasina
REM yaziyoruz -- pencere gormeyeceginden hatayi orada okuyabilirsin.
cd /d "C:\Users\Burak\Downloads\firsatradar\firsatradar\backend"
echo [%date% %time%] Backend baslatiliyor... >> backend_log.txt
node server.js >> backend_log.txt 2>&1
echo [%date% %time%] Backend durdu (yukarida hata olabilir). >> backend_log.txt

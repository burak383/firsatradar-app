@echo off
REM FirsatRadar web uygulamasini (Expo) baslatir.
REM run_hidden.vbs araciligiyla penceresiz calistirilir; bu yuzden TUM
REM ciktiyi frontend_log.txt dosyasina yaziyoruz.
cd /d "C:\Users\Burak\Downloads\firsatradar\firsatradar"
echo [%date% %time%] Frontend (expo web) baslatiliyor... >> frontend_log.txt
npx expo start --web >> frontend_log.txt 2>&1
echo [%date% %time%] Frontend durdu (yukarida hata olabilir). >> frontend_log.txt

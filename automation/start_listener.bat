@echo off
REM Telegram listener'i baslatir (venv icinde).
REM run_hidden.vbs araciligiyla penceresiz calistirilir; bu yuzden TUM
REM ciktiyi listener_log.txt dosyasina yaziyoruz.
cd /d "C:\Users\Burak\Downloads\firsatradar\telegram_listener\telegram_listener"
REM DIKKAT: venv klasoru BIR UST klasorde (telegram_listener\venv), bu
REM klasorun (telegram_listener\telegram_listener) icinde degil -- zip'in
REM cift ic ice cikmasi yuzunden boyle olustu.
call ..\venv\Scripts\activate.bat
echo [%date% %time%] Listener baslatiliyor... >> listener_log.txt
python -u listener.py >> listener_log.txt 2>&1
echo [%date% %time%] Listener durdu (yukarida hata olabilir). >> listener_log.txt

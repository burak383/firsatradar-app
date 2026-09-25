@echo off
REM Telegram'dan yakalanan mesajlari backend'e aktarir. Gorev Zamanlayicisi
REM bunu her birkac dakikada bir sessizce calistirir; sonucu
REM import_log.txt dosyasina yazar (pencere acik kalmaz).
cd /d "C:\Users\Burak\Downloads\firsatradar\firsatradar\backend"
echo [%date% %time%] Import calisiyor... >> import_log.txt
node import_telegram_signals.js "C:\Users\Burak\Downloads\firsatradar\telegram_listener\telegram_listener\data\messages.db" >> import_log.txt 2>&1
echo. >> import_log.txt

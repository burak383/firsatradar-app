' run_hidden.vbs
'
' Verilen .bat dosyasini GORUNMEZ (penceresiz) bir sekilde baslatir ve
' beklemeden hemen cikar -- baslatilan surec (node/python) arka planda
' calismaya devam eder, wscript'in kendisi kapanir. Boylece Gorev
' Zamanlayicisi bunu calistirdiginda ekranda hicbir pencere belirmez,
' o yuzden "yanlislikla kapatma" diye bir sorun kalmaz.
'
' Kullanim: wscript.exe run_hidden.vbs "C:\yol\start_backend.bat"

Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """" & WScript.Arguments(0) & """", 0, False
Set WshShell = Nothing

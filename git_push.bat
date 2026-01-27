@echo off
echo === Git Commit e Push ===
echo.

cd /d "C:\Users\saulo.morales\Desktop\CifrasProX"

echo Adicionando arquivos...
git add .

echo.
echo Fazendo commit...
git commit -m "Fix: Adiciona redirecionamento por role apos login e registro"

echo.
echo Fazendo push para main...
git push origin main

echo.
echo === Concluido! ===
pause

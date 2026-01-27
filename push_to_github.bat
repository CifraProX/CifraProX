@echo off
echo --- Iniciando script de envio para GitHub ---
echo.

echo 1. Inicializando Git...
git init

echo 2. Configurando Remote (https://github.com/CifraProX/CifraProX.git)...
git remote add origin https://github.com/CifraProX/CifraProX.git
:: Se ja existir, garante que esta certo
git remote set-url origin https://github.com/CifraProX/CifraProX.git

echo 3. Preparando arquivos...
git add .

echo 4. Criando Commit...
git commit -m "Correcao: Migracao Firebase Realtime Database e ajustes finais"

echo 5. Enviando para o branch 'main'...
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo Se apareceu 'Everything up-to-date' ou URLs do GitHub, DEU CERTO!
echo Se pediu senha, use seu Personal Access Token.
echo ========================================================
pause

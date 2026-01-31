@echo off
echo Iniciando servidor local CifraProX...
echo O navegador abrira automaticamente. Se nao abrir, acesse: http://localhost:8080
echo.
call npx http-server -c-1 --cors -o
pause

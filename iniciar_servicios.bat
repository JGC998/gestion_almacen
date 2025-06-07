@echo off
TITLE Gestor de Servicios

ECHO Iniciando el servicio del Backend...
cd backend-node
start "Backend (Node.js)" npm run dev

REM Volvemos al directorio raíz para la siguiente instrucción
cd ..

ECHO Iniciando el servicio del Frontend...
cd frontend-react
start "Frontend (React)" npm run dev

ECHO.
ECHO Ambos servicios se han iniciado en ventanas separadas.
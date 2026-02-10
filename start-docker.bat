@echo off
echo Starting Si Crypto Platform with Docker...
echo.

docker-compose down
docker-compose up -d --build

echo.
echo Services are starting...
timeout /t 10

echo.
echo === Si Crypto Platform is Running ===
echo.
echo Frontend: http://localhost:8081
echo Backend:  http://localhost:3000
echo.
echo View logs: docker-compose logs -f
echo Stop all:  docker-compose down
echo.

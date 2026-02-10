@echo off
echo ================================
echo Si Crypto Platform - Git Setup
echo ================================
echo.

REM Configure Git (update with your info)
echo Setting up Git configuration...
git config user.email "your-email@example.com"
git config user.name "Your Name"

echo.
echo Git configured. Now run these commands:
echo.
echo 1. Update deploy-setup.bat with your email and name
echo 2. Run: git add .
echo 3. Run: git commit -m "Initial Si Crypto Platform"
echo 4. Create GitHub repo: https://github.com/new
echo 5. Run: git remote add origin YOUR_GITHUB_URL
echo 6. Run: git push -u origin main
echo.
echo ================================
echo Next: Deploy to Railway
echo ================================
echo.
echo 1. Go to: https://railway.app
echo 2. Login with GitHub
echo 3. Click "New Project" -^> "Deploy from GitHub"
echo 4. Select your repository
echo 5. Add PostgreSQL and Redis databases
echo 6. Configure environment variables (see DEPLOYMENT.md)
echo.
pause

@echo off
echo ========================================
echo Google OAuth Setup Script
echo ========================================
echo.

echo Step 1: Backing up existing files...
if exist public\index.html (
    copy public\index.html public\index.html.backup
    echo   - Backed up index.html
)
if exist public\home.html (
    copy public\home.html public\home.html.backup
    echo   - Backed up home.html
)
echo.

echo Step 2: Copying new authenticated files...
copy index-with-google-auth.html public\index.html
echo   - Created new index.html with Google OAuth
copy home-with-auth.html public\home.html
echo   - Created new home.html with authentication
copy auth-helper.js public\auth-helper.js
echo   - Added auth-helper.js utility
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Your files have been updated with Google OAuth authentication.
echo.
echo Next steps:
echo 1. Start your server: node server.js
echo 2. Open browser: http://localhost:5500
echo 3. Click "Continue with Google" to test
echo.
echo Backup files saved as:
echo   - public\index.html.backup
echo   - public\home.html.backup
echo.
echo See GOOGLE_AUTH_SETUP.md for full documentation.
echo.
pause

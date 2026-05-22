@echo off
cd /d "%~dp0"
echo Creating Python virtual environment...
python -m venv .venv
echo Installing dependencies...
.venv\Scripts\pip install -r requirements.txt
echo Installing Playwright browsers...
.venv\Scripts\playwright install chromium
echo.
echo Setup complete! You can now run:
echo   .venv\Scripts\python run_crawler.py --platform bili --keywords "test"
pause

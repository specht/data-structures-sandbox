@echo off
rem Windows: runs ./new-structure with the bash of Git for Windows.
setlocal
set "GITBASH="
for /f "delims=" %%g in ('where git 2^>nul') do (
  if not defined GITBASH if exist "%%~dpg..\bin\bash.exe" set "GITBASH=%%~dpg..\bin\bash.exe"
  if not defined GITBASH if exist "%%~dpg..\..\bin\bash.exe" set "GITBASH=%%~dpg..\..\bin\bash.exe"
)
if not defined GITBASH goto missing
"%GITBASH%" "%~dp0new-structure" %*
exit /b %errorlevel%
:missing
echo new-structure needs Git for Windows (https://git-scm.com/download/win). 1>&2
exit /b 1

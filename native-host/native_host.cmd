@echo off
py -3 "%~dp0native_host.py"
if errorlevel 9009 python "%~dp0native_host.py"

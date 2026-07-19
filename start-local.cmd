@echo off
cd /d "%~dp0"
set NODE_ENV=production
"C:\Users\31387\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" dist/server.cjs >> dev-server.log 2>> dev-server.err.log

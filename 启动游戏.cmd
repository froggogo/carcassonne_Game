@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 卡卡颂 · 山河之间
echo 请在浏览器打开 http://localhost:8787
echo 其他设备使用下方显示的局域网地址。
echo 保留此窗口以保持房间在线；Ctrl+C 可停止服务器。
node server.cjs
pause

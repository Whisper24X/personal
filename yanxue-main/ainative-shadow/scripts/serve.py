import http.server
import socketserver
import os
import sys
import subprocess
from pathlib import Path

# 获取dist目录的绝对路径
DIRECTORY = Path(__file__).parent.parent / 'dist'
os.chdir(DIRECTORY)

PORT = 3310
HANDLER = http.server.SimpleHTTPRequestHandler

def kill_process_on_port(port):
    """杀死占用指定端口的进程"""
    try:
        if sys.platform.startswith('win'):  # Windows
            # 查找进程
            cmd = f'netstat -ano | findstr :{port}'
            result = subprocess.check_output(cmd, shell=True).decode()
            if result:
                pid = result.strip().split()[-1]
                # 终止进程
                os.system(f'taskkill /F /PID {pid}')
                return True
        else:  # Linux/Mac
            # 查找进程
            cmd = f"lsof -i :{port} | grep LISTEN"
            result = subprocess.check_output(cmd, shell=True).decode()
            if result:
                pid = result.split()[1]
                # 终止进程
                os.system(f'kill -9 {pid}')
                return True
    except subprocess.CalledProcessError:
        pass
    return False

# 支持单页应用路由
class SPAHandler(HANDLER):
    def do_GET(self):
        # 如果请求的文件不存在，返回 index.html
        if not os.path.exists(self.translate_path(self.path)):
            self.path = '/index.html'
        return HANDLER.do_GET(self)

def start_server():
    """启动服务器"""
    try:
        with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
            print(f"Server running at http://localhost:{PORT}")
            httpd.serve_forever()
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"Port {PORT} is already in use. Attempting to kill the process...")
            if kill_process_on_port(PORT):
                print("Process killed. Retrying to start server...")
                start_server()  # 重试启动服务器
            else:
                print(f"Could not free port {PORT}. Please try a different port.")
                sys.exit(1)
        else:
            print(f"Error starting server: {e}")
            sys.exit(1)

if __name__ == "__main__":
    start_server() 
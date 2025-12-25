# mind2build 部署指南

**文档版本**: v1.0  
**创建日期**: 2025-12-24  
**适用版本**: mind2build v1.0+

---

## 目录

1. [系统要求](#1-系统要求)
2. [安装方式](#2-安装方式)
3. [配置指南](#3-配置指南)
4. [部署方式](#4-部署方式)
5. [运维管理](#5-运维管理)
6. [故障排查](#6-故障排查)

---

## 1. 系统要求

### 1.1 硬件要求

**最低配置**:
- CPU: 2核
- 内存: 4GB
- 磁盘: 10GB 可用空间

**推荐配置**:
- CPU: 4核+
- 内存: 8GB+
- 磁盘: 50GB+ SSD

### 1.2 软件要求

**操作系统**:
- ✅ Linux (Ubuntu 20.04+, CentOS 8+)
- ✅ macOS (11.0+)
- ✅ Windows 10/11 + WSL2

**依赖软件**:
- Python: 3.9 - 3.11
- Node.js: 16.0+ (用于 Mermaid)
- pnpm: 最新版本
- Git: 2.30+ (可选)

### 1.3 网络要求

- ✅ 稳定的互联网连接
- ✅ 可访问 LLM API（OpenAI/Anthropic 等）
- ⚠️ 国内用户可能需要配置代理

---

## 2. 安装方式

### 2.1 从 PyPI 安装（推荐）

**Step 1: 创建虚拟环境**
```bash
# 使用 venv
python3.9 -m venv mind2build-env
source mind2build-env/bin/activate  # Linux/macOS
# mind2build-env\Scripts\activate  # Windows

# 或使用 conda
conda create -n mind2build python=3.9
conda activate mind2build
```

**Step 2: 安装 mind2build**
```bash
pip install --upgrade mind2build
```

**Step 3: 安装 Node.js 依赖**
```bash
# macOS
brew install node pnpm

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

# 安装 mermaid-cli
pnpm install -g @mermaid-js/mermaid-cli
```

**Step 4: 验证安装**
```bash
mind2build --version
python -c "import mind2build; print(mind2build.__version__)"
```

### 2.2 从源码安装（开发者）

```bash
# 克隆仓库
git clone https://github.com/geekan/mind2build.git
cd mind2build

# 安装依赖
pip install --upgrade -e .

# 安装开发依赖
pip install -e ".[dev]"
```

### 2.3 使用 Docker 安装

**Step 1: 拉取镜像**
```bash
docker pull mind2build/mind2build:latest
```

**Step 2: 运行容器**
```bash
docker run -it \
  -e OPENAI_API_KEY=your-api-key \
  -v $(pwd)/workspace:/workspace \
  mind2build/mind2build:latest \
  "Create a 2048 game"
```

**Step 3: 使用 Docker Compose**
```yaml
# docker-compose.yml
version: '3.8'

services:
  mind2build:
    image: mind2build/mind2build:latest
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./workspace:/workspace
      - ./config:/root/.mind2build
    command: "Create a TODO app"
```

```bash
docker-compose up
```

---

## 3. 配置指南

### 3.1 初始化配置

```bash
# 创建配置文件
mind2build --init-config
```

这将创建 `~/.mind2build/config2.yaml` 文件。

### 3.2 基础配置

**config2.yaml**:
```yaml
# LLM 配置
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  base_url: "https://api.openai.com/v1"
  api_key: "${OPENAI_API_KEY}"
  temperature: 0.7
  max_tokens: 4096

# 工作空间配置
workspace:
  path: "./workspace"

# 成本配置
cost:
  max_budget: 10.0

# Git 配置（可选）
git:
  enabled: true
  auto_init: true
```

### 3.3 环境变量配置

```bash
# ~/.bashrc 或 ~/.zshrc
export OPENAI_API_KEY="sk-your-api-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# 代理配置（国内用户）
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"

# 日志级别
export LOG_LEVEL="INFO"  # DEBUG/INFO/WARNING/ERROR
```

### 3.4 多 LLM 提供商配置

**OpenAI**:
```yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  api_key: "${OPENAI_API_KEY}"
```

**Azure OpenAI**:
```yaml
llm:
  api_type: "azure"
  model: "gpt-4"
  api_key: "${AZURE_OPENAI_API_KEY}"
  base_url: "https://your-resource.openai.azure.com"
  api_version: "2023-12-01-preview"
```

**Anthropic Claude**:
```yaml
llm:
  api_type: "anthropic"
  model: "claude-3-opus"
  api_key: "${ANTHROPIC_API_KEY}"
```

**本地 Ollama**:
```yaml
llm:
  api_type: "ollama"
  model: "llama2"
  base_url: "http://localhost:11434"
```

---

## 4. 部署方式

### 4.1 本地开发部署

**适用场景**: 个人开发、测试

```bash
# 激活环境
source mind2build-env/bin/activate

# 运行项目
mind2build "Your idea"
```

### 4.2 服务器部署

**Step 1: 创建用户**
```bash
sudo useradd -m -s /bin/bash mind2build
sudo su - mind2build
```

**Step 2: 安装和配置**
```bash
# 安装 mind2build
pip install --user mind2build

# 配置环境
mind2build --init-config
vim ~/.mind2build/config2.yaml
```

**Step 3: 创建服务（systemd）**
```ini
# /etc/systemd/system/mind2build.service
[Unit]
Description=mind2build Service
After=network.target

[Service]
Type=simple
User=mind2build
WorkingDirectory=/home/mind2build
Environment="PATH=/home/mind2build/.local/bin:/usr/bin"
Environment="OPENAI_API_KEY=your-api-key"
ExecStart=/home/mind2build/.local/bin/mind2build "Create projects"
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable mind2build
sudo systemctl start mind2build
sudo systemctl status mind2build
```

### 4.3 Docker 部署

**Dockerfile**:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nodejs npm git && \
    npm install -g pnpm && \
    pnpm install -g @mermaid-js/mermaid-cli && \
    rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .
RUN pip install -e .

# 配置
ENV PYTHONUNBUFFERED=1
VOLUME ["/workspace"]
WORKDIR /workspace

ENTRYPOINT ["mind2build"]
```

**构建和运行**:
```bash
# 构建镜像
docker build -t my-mind2build .

# 运行
docker run -it \
  -e OPENAI_API_KEY=your-key \
  -v $(pwd)/output:/workspace \
  my-mind2build "Create a game"
```

### 4.4 Kubernetes 部署

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mind2build
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mind2build
  template:
    metadata:
      labels:
        app: mind2build
    spec:
      containers:
      - name: mind2build
        image: mind2build/mind2build:latest
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: llm-secrets
              key: openai-key
        volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: config
          mountPath: /root/.mind2build
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: mind2build-workspace
      - name: config
        configMap:
          name: mind2build-config
```

---

## 5. 运维管理

### 5.1 日志管理

**查看日志**:
```bash
# CLI 运行时
mind2build "Your idea" 2>&1 | tee mind2build.log

# 服务日志
journalctl -u mind2build -f
```

**日志配置**:
```python
# custom_logging.py
import logging
from mind2build.logs import logger

# 设置日志级别
logger.setLevel(logging.DEBUG)

# 添加文件处理器
fh = logging.FileHandler('mind2build.log')
fh.setLevel(logging.DEBUG)
logger.addHandler(fh)
```

### 5.2 性能监控

**成本监控**:
```python
from mind2build.team import Team

team = Team()
# ... 运行项目

# 检查成本
print(f"Total cost: ${team.cost_manager.total_cost:.2f}")
print(f"Tokens: {team.cost_manager.total_tokens}")
print(f"Budget remaining: ${team.cost_manager.max_budget - team.cost_manager.total_cost:.2f}")
```

**性能指标**:
```bash
# 监控脚本
#!/bin/bash
while true; do
  echo "=== $(date) ==="
  ps aux | grep mind2build
  df -h | grep workspace
  free -h
  sleep 60
done
```

### 5.3 备份和恢复

**备份配置**:
```bash
# 备份配置文件
tar -czf mind2build-config-$(date +%Y%m%d).tar.gz ~/.mind2build/

# 备份工作空间
tar -czf workspace-$(date +%Y%m%d).tar.gz ./workspace/
```

**恢复**:
```bash
# 恢复配置
tar -xzf mind2build-config-20251224.tar.gz -C ~/

# 恢复工作空间
tar -xzf workspace-20251224.tar.gz
```

---

## 6. 故障排查

### 6.1 常见问题

**问题 1: 安装失败**
```bash
# 错误：pip install 失败
# 解决：升级 pip
python -m pip install --upgrade pip setuptools wheel

# 重新安装
pip install mind2build
```

**问题 2: API Key 无效**
```bash
# 错误：Authentication failed
# 解决：检查 API Key
echo $OPENAI_API_KEY

# 重新设置
export OPENAI_API_KEY="sk-your-correct-key"

# 或修改配置文件
vim ~/.mind2build/config2.yaml
```

**问题 3: Mermaid 图表生成失败**
```bash
# 检查 mermaid-cli 安装
mmdc --version

# 重新安装
pnpm install -g @mermaid-js/mermaid-cli
```

**问题 4: 内存不足**
```bash
# 监控内存
free -h

# 解决：限制并发角色数或增加内存
# 或使用更小的模型（gpt-3.5-turbo）
```

### 6.2 调试技巧

**启用详细日志**:
```bash
export LOG_LEVEL=DEBUG
mind2build "Your idea"
```

**使用 Python 调试**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)

from mind2build.software_company import generate_repo
result = generate_repo("Your idea")
```

**检查依赖**:
```bash
pip list | grep mind2build
pip check
```

### 6.3 性能优化

**优化 Token 使用**:
```yaml
# config2.yaml
llm:
  model: "gpt-3.5-turbo"  # 使用更经济的模型
  max_tokens: 2048        # 限制输出长度
```

**优化并发**:
```python
# 增加并发角色
team.hire([Engineer(), Engineer(), Engineer()])
```

**缓存优化**:
```python
# 使用本地缓存避免重复调用
from functools import lru_cache

@lru_cache(maxsize=100)
def cached_operation(key):
    # 操作逻辑
    pass
```

---

## 7. 安全建议

### 7.1 API Key 管理

- ❌ 不要将 API Key 提交到版本控制
- ✅ 使用环境变量或密钥管理服务
- ✅ 定期轮换 API Key
- ✅ 限制 API Key 权限

### 7.2 网络安全

```bash
# 使用防火墙
sudo ufw allow 22/tcp
sudo ufw enable

# 使用 HTTPS
# 配置反向代理（Nginx）
```

### 7.3 数据安全

- 定期备份配置和数据
- 加密敏感配置文件
- 限制文件访问权限

```bash
chmod 600 ~/.mind2build/config2.yaml
```

---

## 8. 升级指南

### 8.1 版本升级

```bash
# 备份当前版本
pip freeze > requirements-old.txt

# 升级 mind2build
pip install --upgrade mind2build

# 验证
mind2build --version
```

### 8.2 配置迁移

```bash
# 备份旧配置
cp ~/.mind2build/config2.yaml ~/.mind2build/config2.yaml.bak

# 使用新版本配置
mind2build --init-config

# 迁移旧配置内容
# 手动合并或使用脚本
```

---

## 9. 附录

### A. 完整配置示例

```yaml
# ~/.mind2build/config2.yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  base_url: "https://api.openai.com/v1"
  api_key: "${OPENAI_API_KEY}"
  temperature: 0.7
  max_tokens: 4096
  timeout: 60

workspace:
  path: "./workspace"
  use_docker: false

git:
  enabled: true
  auto_init: true
  auto_commit: true

cost:
  max_budget: 10.0

logging:
  level: "INFO"
  file: "~/.mind2build/mind2build.log"

browser:
  engine: "playwright"  # or selenium
  headless: true

code_review:
  enabled: true
  strict_mode: false
```

### B. 环境变量列表

| 变量名 | 说明 | 示例 |
|--------|------|------|
| OPENAI_API_KEY | OpenAI API 密钥 | sk-xxx |
| ANTHROPIC_API_KEY | Anthropic API 密钥 | sk-ant-xxx |
| HTTP_PROXY | HTTP 代理 | http://127.0.0.1:7890 |
| HTTPS_PROXY | HTTPS 代理 | http://127.0.0.1:7890 |
| LOG_LEVEL | 日志级别 | DEBUG/INFO/WARNING |

### C. 资源链接

- 官方文档: https://docs.deepwisdom.ai/
- GitHub: https://github.com/geekan/mind2build
- Discord: https://discord.gg/ZRHeExS6xv
- 问题反馈: GitHub Issues

---

**文档维护**: 持续更新  
**最后更新**: 2025-12-24  
**反馈**: 欢迎提出改进建议

# 在 macOS 上安装 Docker

## Docker 镜像加速配置（国内用户）

若拉取镜像慢或超时，在 Docker Desktop → Settings → Docker Engine 中替换为：

```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false,
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://hub.rat.dev"
  ],
  "insecure-registries": [],
  "debug": false
}
```

保存后点击 **Apply & Restart** 重启 Docker。

---

## 方式一：官网下载（推荐）

1. 打开 [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. 根据芯片选择：
   - **Apple Silicon (M1/M2/M3)**：下载 **Mac with Apple chip**
   - **Intel**：下载 **Mac with Intel chip**
3. 双击 `.dmg` 安装包，将 Docker 拖入 Applications
4. 打开 **应用程序** → 双击 **Docker** 启动
5. 首次启动需同意服务协议，等待 Docker 引擎启动完成（菜单栏出现鲸鱼图标）

## 方式二：使用 Homebrew（若已安装）

```bash
# 若尚未安装 Homebrew，先执行：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Docker Desktop
brew install --cask docker
```

安装后从 **应用程序** 启动 Docker。

---

## 验证安装

终端执行：

```bash
docker --version
docker compose version
```

应能看到版本号。然后启动项目数据库：

```bash
cd backend
docker compose up -d postgres adminer
```

- PostgreSQL：localhost:5432
- Adminer：http://localhost:8080

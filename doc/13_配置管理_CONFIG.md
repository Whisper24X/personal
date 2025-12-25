# mind2build 配置管理文档

**文档版本**: v1.0  
**创建日期**: 2025-12-24

## 1. 配置文件结构

**位置**: `~/.mind2build/config2.yaml`

```yaml
# LLM 配置
llm:
  api_type: "openai"      # openai/azure/anthropic/gemini/ollama
  model: "gpt-4-turbo"    # 模型名称
  base_url: "https://api.openai.com/v1"
  api_key: "${OPENAI_API_KEY}"  # 支持环境变量
  temperature: 0.7
  max_tokens: 4096
  timeout: 60

# 工作空间配置
workspace:
  path: "./workspace"
  use_docker: false

# Git 配置
git:
  enabled: true
  auto_init: true
  auto_commit: false

# 成本配置
cost:
  max_budget: 10.0

# 日志配置
logging:
  level: "INFO"  # DEBUG/INFO/WARNING/ERROR
  file: "~/.mind2build/mind2build.log"

# 浏览器配置
browser:
  engine: "playwright"  # playwright/selenium
  headless: true

# 代码审查配置
code_review:
  enabled: true
  strict_mode: false
```

## 2. 环境变量

```bash
# API Keys
export OPENAI_API_KEY="sk-xxx"
export ANTHROPIC_API_KEY="sk-ant-xxx"
export GOOGLE_API_KEY="xxx"

# 代理（国内用户）
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"

# 日志
export LOG_LEVEL="DEBUG"

# 工作空间
export WORKSPACE_PATH="./workspace"
```

## 3. 配置加载

```python
from mind2build.config2 import Config

# 默认配置
config = Config.default()

# 从文件加载
config = Config.from_yaml("~/.mind2build/config2.yaml")

# 修改配置
config.llm.model = "gpt-3.5-turbo"
config.cost.max_budget = 5.0
```

## 4. 多 LLM 配置示例

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

## 5. 初始化配置

```bash
# 创建配置文件
mind2build --init-config

# 编辑配置
vim ~/.mind2build/config2.yaml
```

---

**参考**: 完整配置见 config/config2.example.yaml

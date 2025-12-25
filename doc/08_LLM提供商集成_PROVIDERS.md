# mind2build LLM 提供商集成文档

**文档版本**: v1.0  
**创建日期**: 2025-12-24

## 支持的提供商

### 1. OpenAI

**配置**:
```yaml
llm:
  api_type: "openai"
  model: "gpt-4-turbo"
  api_key: "${OPENAI_API_KEY}"
  base_url: "https://api.openai.com/v1"
```

**支持的模型**:
- gpt-4-turbo
- gpt-4
- gpt-3.5-turbo

### 2. Azure OpenAI

**配置**:
```yaml
llm:
  api_type: "azure"
  model: "gpt-4"
  api_key: "${AZURE_OPENAI_API_KEY}"
  base_url: "https://your-resource.openai.azure.com"
  api_version: "2023-12-01-preview"
```

### 3. Anthropic Claude

**配置**:
```yaml
llm:
  api_type: "anthropic"
  model: "claude-3-opus"
  api_key: "${ANTHROPIC_API_KEY}"
```

**支持的模型**:
- claude-3-opus
- claude-3-sonnet
- claude-3-haiku

### 4. Google Gemini

**配置**:
```yaml
llm:
  api_type: "gemini"
  model: "gemini-pro"
  api_key: "${GOOGLE_API_KEY}"
```

### 5. 智谱 AI

**配置**:
```yaml
llm:
  api_type: "zhipuai"
  model: "glm-4"
  api_key: "${ZHIPUAI_API_KEY}"
```

### 6. 本地 Ollama

**配置**:
```yaml
llm:
  api_type: "ollama"
  model: "llama2"
  base_url: "http://localhost:11434"
```

## 自定义提供商

```python
from mind2build.provider.base_llm import BaseLLM

class CustomLLM(BaseLLM):
    async def _achat_completion(self, messages: list[dict], **kwargs) -> dict:
        # 实现 API 调用
        response = await your_api_call(messages)
        return response
    
    async def acompletion_text(self, messages: list[dict], **kwargs) -> str:
        result = await self._achat_completion(messages, **kwargs)
        return result["content"]

# 注册
from mind2build.provider.llm_provider_registry import LLM_REGISTRY
LLM_REGISTRY["custom"] = CustomLLM
```

---

**参考**: 完整实现见 mind2build/provider/

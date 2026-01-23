-- ============================================================================
-- LLM Models Table (Global Model Registry)
-- Stores available models for each LLM provider
-- ============================================================================

CREATE TABLE IF NOT EXISTS llm_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  is_default BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_llm_models_provider ON llm_models(provider);
CREATE INDEX IF NOT EXISTS idx_llm_models_sort_order ON llm_models(sort_order);

COMMENT ON TABLE llm_models IS '全局LLM模型注册表，存储各服务商可用的模型列表';
COMMENT ON COLUMN llm_models.provider IS 'LLM提供商名称: openai, zhipuai, ark, anthropic, deepseek, gemini, qianfan, dashscope, ollama, cursor';
COMMENT ON COLUMN llm_models.model_name IS '模型名称/ID';
COMMENT ON COLUMN llm_models.display_name IS '模型显示名称（可选）';
COMMENT ON COLUMN llm_models.is_default IS '是否为该服务商的默认模型';
COMMENT ON COLUMN llm_models.sort_order IS '排序顺序，数值越小越靠前';

-- Insert default models for each provider
INSERT INTO llm_models (provider, model_name, display_name, is_default, sort_order) VALUES
  -- OpenAI
  ('openai', 'gpt-4-turbo', 'GPT-4 Turbo', true, 1),
  ('openai', 'gpt-4', 'GPT-4', false, 2),
  ('openai', 'gpt-4o', 'GPT-4o', false, 3),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', false, 4),
  ('openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', false, 5),
  -- 智谱AI
  ('zhipuai', 'glm-4-flash', 'GLM-4 Flash', true, 1),
  ('zhipuai', 'glm-4', 'GLM-4', false, 2),
  ('zhipuai', 'glm-3-turbo', 'GLM-3 Turbo', false, 3),
  -- 火山引擎 Ark (豆包)
  ('ark', 'doubao-1-5-pro-32k-250115', 'Doubao 1.5 Pro 32K', true, 1),
  ('ark', 'doubao-pro-32k', 'Doubao Pro 32K', false, 2),
  -- Anthropic Claude
  ('anthropic', 'claude-3-opus-20240229', 'Claude 3 Opus', true, 1),
  ('anthropic', 'claude-3-sonnet-20240229', 'Claude 3 Sonnet', false, 2),
  ('anthropic', 'claude-3-haiku-20240307', 'Claude 3 Haiku', false, 3),
  ('anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', false, 4),
  -- DeepSeek
  ('deepseek', 'deepseek-chat', 'DeepSeek Chat', true, 1),
  ('deepseek', 'deepseek-coder', 'DeepSeek Coder', false, 2),
  ('deepseek', 'deepseek-v3-2', 'DeepSeek V3.2', false, 3),
  -- Google Gemini
  ('gemini', 'gemini-pro', 'Gemini Pro', true, 1),
  ('gemini', 'gemini-1.5-pro', 'Gemini 1.5 Pro', false, 2),
  ('gemini', 'gemini-1.5-flash', 'Gemini 1.5 Flash', false, 3),
  -- 百度千帆
  ('qianfan', 'ERNIE-Bot', 'ERNIE Bot', true, 1),
  ('qianfan', 'ERNIE-Bot-4', 'ERNIE Bot 4', false, 2),
  -- 阿里通义
  ('dashscope', 'qwen-turbo', 'Qwen Turbo', true, 1),
  ('dashscope', 'qwen-plus', 'Qwen Plus', false, 2),
  ('dashscope', 'qwen-max', 'Qwen Max', false, 3),
  -- Ollama
  ('ollama', 'llama2', 'Llama 2', true, 1),
  ('ollama', 'codellama', 'Code Llama', false, 2),
  ('ollama', 'mistral', 'Mistral', false, 3),
  -- Cursor
  ('cursor', 'auto', 'Auto', true, 1)
ON CONFLICT (provider, model_name) DO NOTHING;

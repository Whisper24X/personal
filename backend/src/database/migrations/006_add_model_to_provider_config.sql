-- Add model field to llm_provider_configs table
-- This allows users to configure a default model when setting up provider credentials

-- Add model column to llm_provider_configs table
ALTER TABLE llm_provider_configs 
ADD COLUMN IF NOT EXISTS model VARCHAR(100);

-- Add comment to the new column
COMMENT ON COLUMN llm_provider_configs.model IS 'Default model for the provider (optional)';

-- Update existing records with default models based on provider type
UPDATE llm_provider_configs 
SET model = CASE provider
  WHEN 'openai' THEN 'gpt-4-turbo'
  WHEN 'zhipuai' THEN 'glm-4-flash'
  WHEN 'ark' THEN 'doubao-1-5-pro-32k-250115'
  WHEN 'anthropic' THEN 'claude-3-opus-20240229'
  WHEN 'gemini' THEN 'gemini-pro'
  WHEN 'qianfan' THEN 'ERNIE-Bot'
  WHEN 'dashscope' THEN 'qwen-turbo'
  WHEN 'ollama' THEN 'llama2'
  WHEN 'cursor' THEN 'auto'
  ELSE NULL
END
WHERE model IS NULL;


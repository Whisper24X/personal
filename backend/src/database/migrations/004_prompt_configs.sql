-- Create prompt_configs table
-- Stores prompt templates and system prompts for different prompt types
CREATE TABLE IF NOT EXISTS prompt_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt_type VARCHAR(50) NOT NULL,
  prompt_key VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  UNIQUE(user_id, prompt_type, prompt_key)
);

CREATE INDEX IF NOT EXISTS idx_prompt_configs_user_id ON prompt_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_configs_type ON prompt_configs(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompt_configs_key ON prompt_configs(prompt_key);
CREATE INDEX IF NOT EXISTS idx_prompt_configs_active ON prompt_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_configs_deleted_at ON prompt_configs(deleted_at);

COMMENT ON TABLE prompt_configs IS 'Stores prompt templates and system prompts for different prompt types';
COMMENT ON COLUMN prompt_configs.prompt_type IS 'Prompt type: requirement, prd, design, code, test, task';
COMMENT ON COLUMN prompt_configs.prompt_key IS 'Prompt key: system_prompt, template, etc.';
COMMENT ON COLUMN prompt_configs.content IS 'The actual prompt content';
COMMENT ON COLUMN prompt_configs.description IS 'Description of what this prompt is used for';


-- LLM Configuration Table Migration
-- Adds support for storing LLM provider configurations in database

-- Create llm_configs table
CREATE TABLE IF NOT EXISTS llm_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key VARCHAR(500),
  base_url VARCHAR(500),
  model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INT DEFAULT 8000,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create unique index for active configs (excluding deleted ones)
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_configs_user_provider_active 
ON llm_configs(user_id, provider) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_llm_configs_user_id ON llm_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON llm_configs(provider);
CREATE INDEX IF NOT EXISTS idx_llm_configs_is_active ON llm_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_llm_configs_deleted_at ON llm_configs(deleted_at);

-- Add comment
COMMENT ON TABLE llm_configs IS 'Stores LLM provider configurations per user';


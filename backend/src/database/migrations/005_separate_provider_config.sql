-- Separate Provider Configuration from Model Configuration
-- This migration separates API keys and base URLs (provider-level) from model configurations
-- Users can configure provider credentials once and switch between models without re-entering credentials

-- Step 1: Create llm_provider_configs table to store provider-level configuration
CREATE TABLE IF NOT EXISTS llm_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key VARCHAR(500),
  base_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_user_id ON llm_provider_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_provider ON llm_provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_deleted_at ON llm_provider_configs(deleted_at);
-- Create unique partial index for (user_id, provider) where deleted_at IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_provider_configs_user_provider_unique 
  ON llm_provider_configs(user_id, provider) 
  WHERE deleted_at IS NULL;

COMMENT ON TABLE llm_provider_configs IS 'Stores provider-level configuration (API keys and base URLs) per user';
COMMENT ON COLUMN llm_provider_configs.provider IS 'LLM provider name (e.g., openai, zhipuai, ark)';
COMMENT ON COLUMN llm_provider_configs.api_key IS 'API key for the provider';
COMMENT ON COLUMN llm_provider_configs.base_url IS 'Base URL for the provider API (optional)';

-- Step 2: Migrate existing data from llm_configs to llm_provider_configs
-- Extract unique provider configurations and create provider configs
INSERT INTO llm_provider_configs (user_id, provider, api_key, base_url, created_at, updated_at)
SELECT DISTINCT ON (user_id, provider)
  user_id,
  provider,
  api_key,
  base_url,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM llm_configs
WHERE deleted_at IS NULL
  AND (api_key IS NOT NULL OR base_url IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM llm_provider_configs lpc
    WHERE lpc.user_id = llm_configs.user_id
      AND lpc.provider = llm_configs.provider
      AND lpc.deleted_at IS NULL
  )
GROUP BY user_id, provider, api_key, base_url;

-- Step 3: Remove api_key and base_url columns from llm_configs
-- Note: We'll keep the columns for now but mark them as deprecated
-- They will be removed in a future migration after verifying the new structure works

-- Add a comment to mark these columns as deprecated
COMMENT ON COLUMN llm_configs.api_key IS 'DEPRECATED: Use llm_provider_configs.api_key instead';
COMMENT ON COLUMN llm_configs.base_url IS 'DEPRECATED: Use llm_provider_configs.base_url instead';


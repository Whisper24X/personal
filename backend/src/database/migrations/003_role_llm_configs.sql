-- Create role_llm_configs table
-- Stores LLM configuration for each role profile
CREATE TABLE IF NOT EXISTS role_llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_profile VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT,
  base_url TEXT,
  model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  -- Cursor-specific fields
  repository TEXT,
  branch_name TEXT,
  auto_create_pr BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_profile)
);

CREATE INDEX IF NOT EXISTS idx_role_llm_configs_user_id ON role_llm_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_role_llm_configs_role_profile ON role_llm_configs(role_profile);

COMMENT ON TABLE role_llm_configs IS 'Stores LLM configuration for each role profile';
COMMENT ON COLUMN role_llm_configs.role_profile IS 'Role profile name (e.g., Engineer, ProductManager)';
COMMENT ON COLUMN role_llm_configs.repository IS 'GitHub repository URL for Cursor Agent';
COMMENT ON COLUMN role_llm_configs.branch_name IS 'Branch name for Cursor Agent';
COMMENT ON COLUMN role_llm_configs.auto_create_pr IS 'Whether to auto-create PR for Cursor Agent';


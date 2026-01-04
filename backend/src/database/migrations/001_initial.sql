-- Mind2Build Database Schema
-- Initial migration (includes PRD management and applications)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  avatar_url VARCHAR(500),
  api_keys JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Create applications table (needed before projects)
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);

-- Create projects table (with application_id column)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  idea TEXT NOT NULL,
  description TEXT,
  project_path VARCHAR(500),
  status VARCHAR(20) DEFAULT 'pending',
  progress INT DEFAULT 0,
  n_round INT DEFAULT 5,
  current_round INT DEFAULT 0,
  investment DECIMAL(10,2) DEFAULT 10.0,
  total_cost DECIMAL(10,2) DEFAULT 0.0,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_application_id ON projects(application_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  investment DECIMAL(10,2) DEFAULT 10.0,
  idea TEXT NOT NULL,
  use_mgx BOOLEAN DEFAULT true,
  env_type VARCHAR(50) DEFAULT 'Environment',
  status VARCHAR(20) DEFAULT 'idle',
  config JSONB DEFAULT '{}',
  state JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_project_id ON teams(project_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  profile VARCHAR(100) NOT NULL,
  goal TEXT,
  constraints TEXT,
  description TEXT,
  is_idle BOOLEAN DEFAULT true,
  state_index INT DEFAULT 0,
  max_react_loop INT DEFAULT 1,
  react_mode VARCHAR(20) DEFAULT 'react',
  enable_memory BOOLEAN DEFAULT true,
  use_fixed_sop BOOLEAN DEFAULT false,
  tools JSONB DEFAULT '[]',
  actions_list JSONB DEFAULT '[]',
  watch_actions JSONB DEFAULT '[]',
  state JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_team_id ON roles(team_id);
CREATE INDEX IF NOT EXISTS idx_roles_profile ON roles(profile);
CREATE INDEX IF NOT EXISTS idx_roles_is_idle ON roles(is_idle);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  message_uuid UUID UNIQUE NOT NULL,
  content TEXT NOT NULL,
  instruct_content JSONB,
  role_type VARCHAR(50) NOT NULL,
  cause_by VARCHAR(100) NOT NULL,
  sent_from VARCHAR(100) NOT NULL,
  send_to JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_role_id ON messages(role_id);
CREATE INDEX IF NOT EXISTS idx_messages_cause_by ON messages(cause_by);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Create actions table
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  input_data JSONB,
  output_data JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  duration DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_role_id ON actions(role_id);
CREATE INDEX IF NOT EXISTS idx_actions_message_id ON actions(message_id);
CREATE INDEX IF NOT EXISTS idx_actions_action_type ON actions(action_type);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);

-- Create documents table (with PRD version management columns)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  doc_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  storage_path VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(version);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_documents_prd_version ON documents(project_id, doc_type, version) WHERE doc_type = 'prd';

-- Create cost_records table
CREATE TABLE IF NOT EXISTS cost_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  model VARCHAR(50) NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  cost DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_records_project_id ON cost_records(project_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_role_id ON cost_records(role_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_created_at ON cost_records(created_at DESC);

-- Create memories table (for future use)
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memories_role_id ON memories(role_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_expires_at ON memories(expires_at);

-- Create embeddings table (for future use)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  vector JSONB NOT NULL,
  model VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_memory_id ON embeddings(memory_id);

-- Insert default user for development
INSERT INTO users (id, username, email, password_hash, full_name) 
VALUES ('302769d6-247d-43db-a005-0519712255fb', 'default-user', 'default@mind2build.com', 'not-used', 'Default User')
ON CONFLICT (username) DO NOTHING;

-- Add comments (if supported)
DO $$ 
BEGIN
  COMMENT ON TABLE applications IS 'Applications group related projects together';
  COMMENT ON COLUMN projects.application_id IS 'Reference to parent application';
  COMMENT ON COLUMN documents.version IS 'Document version number, starts from 1';
  COMMENT ON COLUMN documents.is_deleted IS 'Soft delete flag for documents';
  COMMENT ON COLUMN documents.deleted_at IS 'Timestamp when document was soft deleted';
  COMMENT ON COLUMN documents.parent_id IS 'Reference to parent document version for version chain';
EXCEPTION
  WHEN OTHERS THEN
    -- Comments might not be supported in all PostgreSQL versions, ignore errors
    NULL;
END $$;

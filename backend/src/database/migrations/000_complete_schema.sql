-- ============================================================================
-- Mind2Build 完整数据库表结构
-- 基于代码实际使用情况重新设计
-- 创建日期: 2025-01-XX
-- ============================================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. 用户相关表
-- ============================================================================

-- 1.1 users (用户表)
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

COMMENT ON TABLE users IS '用户账户信息表';
COMMENT ON COLUMN users.api_keys IS '存储各种 LLM API Keys (加密)';
COMMENT ON COLUMN users.config IS '用户配置信息';
COMMENT ON COLUMN users.status IS '用户状态: active, inactive, banned';

-- ============================================================================
-- 2. 应用和项目相关表
-- ============================================================================

-- 2.1 applications (应用表)
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

COMMENT ON TABLE applications IS '应用信息表，用于组织相关项目';
COMMENT ON COLUMN applications.metadata IS '应用元数据';

-- 2.2 projects (项目表)
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

COMMENT ON TABLE projects IS '项目信息表';
COMMENT ON COLUMN projects.status IS '项目状态: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN projects.progress IS '项目进度 0-100';
COMMENT ON COLUMN projects.n_round IS '计划轮数';
COMMENT ON COLUMN projects.current_round IS '当前轮数';
COMMENT ON COLUMN projects.investment IS '预算金额';
COMMENT ON COLUMN projects.total_cost IS '实际花费金额';

-- ============================================================================
-- 3. 团队和角色相关表
-- ============================================================================

-- 3.1 teams (团队表)
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

COMMENT ON TABLE teams IS '团队信息表，一个项目对应一个团队';
COMMENT ON COLUMN teams.env_type IS '环境类型: Environment, MGXEnv';
COMMENT ON COLUMN teams.status IS '团队状态: idle, running, stopped';
COMMENT ON COLUMN teams.state IS '序列化的团队状态';

-- 3.2 roles (角色表)
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

COMMENT ON TABLE roles IS '角色实例表';
COMMENT ON COLUMN roles.profile IS '角色类型: ProductManager, Architect, Engineer, QAEngineer, TeamLeader, Salesperson, DataAnalyst';
COMMENT ON COLUMN roles.actions_list IS 'Action类型列表';
COMMENT ON COLUMN roles.watch_actions IS '订阅的 Action';
COMMENT ON COLUMN roles.state IS '完整的 RoleContext 序列化数据';
COMMENT ON COLUMN roles.react_mode IS '反应模式: react, by_order, plan_and_act';

-- ============================================================================
-- 4. 消息和行动相关表
-- ============================================================================

-- 4.1 messages (消息表)
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

COMMENT ON TABLE messages IS '消息记录表';
COMMENT ON COLUMN messages.message_uuid IS 'Message.id (UUID格式)';
COMMENT ON COLUMN messages.instruct_content IS '结构化的指令内容';
COMMENT ON COLUMN messages.cause_by IS '触发此消息的 Action 类名';
COMMENT ON COLUMN messages.role_type IS '消息角色类型: system, user, assistant';
COMMENT ON COLUMN messages.send_to IS '接收者列表 (JSONB数组)';

-- 4.2 actions (行动记录表)
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

COMMENT ON TABLE actions IS '行动记录表，记录所有 Action 的执行';
COMMENT ON COLUMN actions.action_type IS 'Action 类名: WritePRD, WriteDesign, WriteCode, ExecuteSubtask等';
COMMENT ON COLUMN actions.status IS '执行状态: pending, running, completed, failed';
COMMENT ON COLUMN actions.duration IS '执行时长（秒）';

-- ============================================================================
-- 5. 文档相关表
-- ============================================================================

-- 5.1 documents (文档表)
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

COMMENT ON TABLE documents IS '文档表，存储生成的文档（支持版本管理和软删除）';
COMMENT ON COLUMN documents.doc_type IS '文档类型: PRD, Design, Code, Test, README, Config';
COMMENT ON COLUMN documents.version IS '文档版本号，从1开始';
COMMENT ON COLUMN documents.is_deleted IS '软删除标记，用于PRD版本管理';
COMMENT ON COLUMN documents.parent_id IS '指向父版本，形成版本链';

-- ============================================================================
-- 6. 成本记录表
-- ============================================================================

-- 6.1 cost_records (成本记录表)
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

COMMENT ON TABLE cost_records IS '成本记录表，跟踪 LLM 调用成本';
COMMENT ON COLUMN cost_records.cost IS '成本（美元）';

-- ============================================================================
-- 7. 记忆和向量相关表
-- ============================================================================

-- 7.1 memories (长期记忆表)
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

COMMENT ON TABLE memories IS '长期记忆表，存储角色的长期记忆';

-- 7.2 embeddings (向量嵌入表)
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  vector JSONB NOT NULL,
  model VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_memory_id ON embeddings(memory_id);

COMMENT ON TABLE embeddings IS '向量嵌入表，存储文本的向量嵌入（用于语义搜索）';
COMMENT ON COLUMN embeddings.vector IS '向量数据 (JSONB格式，未来可考虑使用pgvector扩展)';

-- ============================================================================
-- 8. LLM配置相关表
-- ============================================================================

-- 8.1 llm_configs (LLM配置表)
CREATE TABLE IF NOT EXISTS llm_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INT DEFAULT 8000,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_configs_user_provider_active 
ON llm_configs(user_id, provider) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_llm_configs_user_id ON llm_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_configs_provider ON llm_configs(provider);
CREATE INDEX IF NOT EXISTS idx_llm_configs_is_active ON llm_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_llm_configs_deleted_at ON llm_configs(deleted_at);

COMMENT ON TABLE llm_configs IS 'LLM配置表，存储用户的LLM模型配置（API keys和base URLs请使用llm_provider_configs表）';

-- 8.2 llm_provider_configs (LLM提供商配置表)
CREATE TABLE IF NOT EXISTS llm_provider_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key VARCHAR(500),
  base_url VARCHAR(500),
  model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_provider_configs_user_provider_unique 
ON llm_provider_configs(user_id, provider) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_user_id ON llm_provider_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_provider ON llm_provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_llm_provider_configs_deleted_at ON llm_provider_configs(deleted_at);

COMMENT ON TABLE llm_provider_configs IS 'LLM提供商配置表，存储提供商级别的配置（API keys和base URLs）';
COMMENT ON COLUMN llm_provider_configs.provider IS 'LLM提供商名称: openai, zhipuai, ark, anthropic, gemini, qianfan, dashscope, ollama, cursor';
COMMENT ON COLUMN llm_provider_configs.model IS '提供商的默认模型（可选）';

-- 8.3 role_llm_configs (角色LLM配置表)
CREATE TABLE IF NOT EXISTS role_llm_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_profile VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT,
  base_url TEXT,
  model VARCHAR(100) NOT NULL,
  temperature DECIMAL(3,2),
  max_tokens INTEGER,
  repository TEXT,
  branch_name TEXT,
  auto_create_pr BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role_profile)
);

CREATE INDEX IF NOT EXISTS idx_role_llm_configs_user_id ON role_llm_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_role_llm_configs_role_profile ON role_llm_configs(role_profile);

COMMENT ON TABLE role_llm_configs IS '角色LLM配置表，存储每个角色配置文件的LLM配置';
COMMENT ON COLUMN role_llm_configs.role_profile IS '角色配置文件名称: Engineer, ProductManager等';
COMMENT ON COLUMN role_llm_configs.repository IS 'GitHub仓库URL（用于Cursor Agent）';
COMMENT ON COLUMN role_llm_configs.branch_name IS '分支名称（用于Cursor Agent）';
COMMENT ON COLUMN role_llm_configs.auto_create_pr IS '是否自动创建PR（用于Cursor Agent）';

-- ============================================================================
-- 9. Prompt配置表
-- ============================================================================

-- 9.1 prompt_configs (Prompt配置表)
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

COMMENT ON TABLE prompt_configs IS 'Prompt配置表，存储不同提示类型的模板和系统提示词';
COMMENT ON COLUMN prompt_configs.prompt_type IS '提示类型: prd, design, code, test, task';
COMMENT ON COLUMN prompt_configs.prompt_key IS '提示键: system_prompt, template, review_system_prompt等';
COMMENT ON COLUMN prompt_configs.content IS '实际的提示内容';

-- ============================================================================
-- 10. 知识库相关表
-- ============================================================================

-- 10.1 knowledge_base (知识库表)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_project_id ON knowledge_base(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_is_active ON knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_deleted_at ON knowledge_base(deleted_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON knowledge_base USING GIN(tags);

COMMENT ON TABLE knowledge_base IS '知识库表，存储项目级别的知识库文档，用于RAG检索';
COMMENT ON COLUMN knowledge_base.tags IS '标签数组，用于分类和过滤文档';
COMMENT ON COLUMN knowledge_base.is_active IS '文档是否激活并可搜索';

-- ============================================================================
-- 11. 会话相关表
-- ============================================================================

-- 11.1 section_conversations (章节对话表)
CREATE TABLE IF NOT EXISTS section_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  section_number INT NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'PRD',
  application_id UUID,
  version INT DEFAULT 1,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, section_number, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_section_conversations_project_id ON section_conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_section_conversations_document_id ON section_conversations(document_id);
CREATE INDEX IF NOT EXISTS idx_section_conversations_section_number ON section_conversations(section_number);
CREATE INDEX IF NOT EXISTS idx_section_conversations_document_type ON section_conversations(document_type);
CREATE INDEX IF NOT EXISTS idx_section_conversations_lookup ON section_conversations(project_id, section_number, document_type, version);

COMMENT ON TABLE section_conversations IS '章节对话表，存储章节调整的对话历史';
COMMENT ON COLUMN section_conversations.messages IS '对话消息数组，包含role、content和timestamp';
COMMENT ON COLUMN section_conversations.document_type IS '文档类型: PRD, Design等';
COMMENT ON COLUMN section_conversations.section_number IS '章节编号';

-- 11.2 interactive_session_workflows (交互式会话工作流表)
CREATE TABLE IF NOT EXISTS interactive_session_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(100) NOT NULL,
  action VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, role, action)
);

CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_project_id ON interactive_session_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_status ON interactive_session_workflows(status);
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_role ON interactive_session_workflows(role);

COMMENT ON TABLE interactive_session_workflows IS '交互式会话工作流表，存储交互式会话中所有角色和行动的状态';
COMMENT ON COLUMN interactive_session_workflows.status IS '工作流项状态: pending, running, completed, failed';

-- 11.3 interactive_session_running_state (交互式会话运行状态表)
CREATE TABLE IF NOT EXISTS interactive_session_running_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "current_role" VARCHAR(100),
  current_action VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactive_session_running_state_project_id ON interactive_session_running_state(project_id);

COMMENT ON TABLE interactive_session_running_state IS '交互式会话运行状态表，存储当前运行的角色和行动';
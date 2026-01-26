-- ============================================================================
-- Mind2Build 数据库完整 Schema
-- 统一整合所有数据库迁移文件
-- 创建日期: 2026-01-26
-- 表数量: 19 张
-- ============================================================================

-- ============================================================================
-- 第一部分：删除所有现有表和对象
-- ============================================================================

-- 删除触发器
DROP TRIGGER IF EXISTS trigger_single_default_workflow ON application_workflows;
DROP TRIGGER IF EXISTS trigger_single_active_version ON project_versions;

-- 删除函数
DROP FUNCTION IF EXISTS ensure_single_default_workflow();
DROP FUNCTION IF EXISTS ensure_single_active_version();

-- 删除表（按依赖顺序，从子表到父表）
DROP TABLE IF EXISTS embeddings CASCADE;
DROP TABLE IF EXISTS memories CASCADE;
DROP TABLE IF EXISTS action_logs CASCADE;
DROP TABLE IF EXISTS section_conversations CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS cost_records CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS project_versions CASCADE;
DROP TABLE IF EXISTS application_workflows CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS llm_configs CASCADE;
DROP TABLE IF EXISTS prompt_configs CASCADE;
DROP TABLE IF EXISTS role_definitions CASCADE;
DROP TABLE IF EXISTS action_definitions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- 第二部分：创建扩展
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 第三部分：创建表（按依赖顺序，从父表到子表）
-- ============================================================================

-- ============================================================================
-- 1. users（用户表）
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    avatar_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active',
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE users IS '用户账户表';
COMMENT ON COLUMN users.id IS '用户唯一标识（UUID）';
COMMENT ON COLUMN users.username IS '用户名（唯一）';
COMMENT ON COLUMN users.email IS '邮箱地址（唯一）';
COMMENT ON COLUMN users.password_hash IS '密码哈希值';
COMMENT ON COLUMN users.full_name IS '用户全名';
COMMENT ON COLUMN users.avatar_url IS '头像URL地址';
COMMENT ON COLUMN users.status IS '用户状态: active（活跃）, inactive（非活跃）, banned（已封禁）';
COMMENT ON COLUMN users.config IS '用户偏好配置（JSON格式）';
COMMENT ON COLUMN users.created_at IS '创建时间';
COMMENT ON COLUMN users.updated_at IS '更新时间';
COMMENT ON COLUMN users.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 2. role_definitions（角色元定义表）
-- ============================================================================
CREATE TABLE role_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200),
    goal TEXT,
    constraints TEXT,
    description TEXT,
    class_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_role_definitions_profile ON role_definitions(profile);
CREATE INDEX idx_role_definitions_active ON role_definitions(is_active) WHERE is_active = true;

COMMENT ON TABLE role_definitions IS '角色元定义表（系统级角色定义）';
COMMENT ON COLUMN role_definitions.id IS '角色定义唯一标识（UUID）';
COMMENT ON COLUMN role_definitions.profile IS '角色类型标识（唯一），如 ProductManager, Architect, Engineer 等';
COMMENT ON COLUMN role_definitions.name IS '角色名称';
COMMENT ON COLUMN role_definitions.display_name IS '角色显示名称';
COMMENT ON COLUMN role_definitions.goal IS '角色目标描述';
COMMENT ON COLUMN role_definitions.constraints IS '角色约束条件';
COMMENT ON COLUMN role_definitions.description IS '角色详细描述';
COMMENT ON COLUMN role_definitions.class_name IS '对应的代码类名';
COMMENT ON COLUMN role_definitions.is_active IS '是否激活（true表示可用）';
COMMENT ON COLUMN role_definitions.metadata IS '角色元数据（JSON格式）';
COMMENT ON COLUMN role_definitions.created_at IS '创建时间';
COMMENT ON COLUMN role_definitions.updated_at IS '更新时间';

-- ============================================================================
-- 3. action_definitions（Action 元定义表）
-- ============================================================================
CREATE TABLE action_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    description TEXT,
    class_name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_action_definitions_name ON action_definitions(name);
CREATE INDEX idx_action_definitions_category ON action_definitions(category);
CREATE INDEX idx_action_definitions_active ON action_definitions(is_active) WHERE is_active = true;

COMMENT ON TABLE action_definitions IS 'Action 元定义表（系统级 Action 定义）';
COMMENT ON COLUMN action_definitions.id IS 'Action定义唯一标识（UUID）';
COMMENT ON COLUMN action_definitions.name IS 'Action 名称标识（唯一），如 WritePRD, WriteDesign, WriteCode 等';
COMMENT ON COLUMN action_definitions.display_name IS 'Action 显示名称';
COMMENT ON COLUMN action_definitions.description IS 'Action 详细描述';
COMMENT ON COLUMN action_definitions.class_name IS '对应的代码类名';
COMMENT ON COLUMN action_definitions.category IS 'Action 分类: document_writing（文档编写）, review（评审）, improvement（改进）';
COMMENT ON COLUMN action_definitions.is_active IS '是否激活（true表示可用）';
COMMENT ON COLUMN action_definitions.metadata IS 'Action 元数据（JSON格式）';
COMMENT ON COLUMN action_definitions.created_at IS '创建时间';
COMMENT ON COLUMN action_definitions.updated_at IS '更新时间';

-- ============================================================================
-- 4. applications（应用/业务线表）
-- ============================================================================
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);

COMMENT ON TABLE applications IS '应用/业务线表，用于组织相关项目';
COMMENT ON COLUMN applications.id IS '应用唯一标识（UUID）';
COMMENT ON COLUMN applications.user_id IS '所属用户ID（外键关联users表）';
COMMENT ON COLUMN applications.name IS '应用名称';
COMMENT ON COLUMN applications.description IS '应用描述';
COMMENT ON COLUMN applications.metadata IS '应用元数据（JSON格式）';
COMMENT ON COLUMN applications.created_at IS '创建时间';
COMMENT ON COLUMN applications.updated_at IS '更新时间';
COMMENT ON COLUMN applications.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 5. projects（项目表 - 合并原 teams 表）
-- ============================================================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    
    -- 基本信息
    name VARCHAR(200) NOT NULL,
    name_alias VARCHAR(200),
    idea TEXT,
    description TEXT,
    
    -- 路径和仓库
    workspace_path VARCHAR(500),
    git_repo_url VARCHAR(500),
    
    -- 状态和进度
    status VARCHAR(20) DEFAULT 'pending',
    progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- 预算和成本
    budget DECIMAL(10,2) DEFAULT 10.0,
    total_cost DECIMAL(10,2) DEFAULT 0.0,
    
    -- 团队配置（原 teams 表字段）
    team_status VARCHAR(20) DEFAULT 'idle',
    team_config JSONB DEFAULT '{}',
    team_state JSONB DEFAULT '{}',
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    
    -- 时间戳
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_application_id ON projects(application_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

COMMENT ON TABLE projects IS '项目表（合并原 teams 表）';
COMMENT ON COLUMN projects.id IS '项目唯一标识（UUID）';
COMMENT ON COLUMN projects.user_id IS '所属用户ID（外键关联users表）';
COMMENT ON COLUMN projects.application_id IS '所属应用ID（外键关联applications表，可为NULL）';
COMMENT ON COLUMN projects.name IS '项目名称';
COMMENT ON COLUMN projects.name_alias IS '项目英文别名，用于生成 Git 分支名';
COMMENT ON COLUMN projects.idea IS '项目需求/想法描述（已迁移至project_versions表，此字段保留用于兼容）';
COMMENT ON COLUMN projects.description IS '项目描述';
COMMENT ON COLUMN projects.workspace_path IS '工作空间路径';
COMMENT ON COLUMN projects.git_repo_url IS 'Git 仓库 URL';
COMMENT ON COLUMN projects.status IS '项目状态: pending（待处理）, running（运行中）, completed（已完成）, failed（失败）, cancelled（已取消）';
COMMENT ON COLUMN projects.progress IS '项目进度（0-100的整数）';
COMMENT ON COLUMN projects.budget IS '预算金额（美元）';
COMMENT ON COLUMN projects.total_cost IS '实际花费（美元）';
COMMENT ON COLUMN projects.team_status IS '团队运行状态: idle（空闲）, running（运行中）, stopped（已停止）';
COMMENT ON COLUMN projects.team_config IS '团队配置（JSON格式）';
COMMENT ON COLUMN projects.team_state IS '团队运行时状态（JSON格式）';
COMMENT ON COLUMN projects.metadata IS '项目元数据（JSON格式）';
COMMENT ON COLUMN projects.started_at IS '项目开始时间';
COMMENT ON COLUMN projects.completed_at IS '项目完成时间';
COMMENT ON COLUMN projects.created_at IS '创建时间';
COMMENT ON COLUMN projects.updated_at IS '更新时间';
COMMENT ON COLUMN projects.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 6. project_versions（项目版本表）
-- ============================================================================
CREATE TABLE project_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 版本信息
    version_name VARCHAR(50) NOT NULL,
    description TEXT,
    idea TEXT,
    
    -- Git 分支信息
    branch_name VARCHAR(200) NOT NULL,
    
    -- 状态
    is_active BOOLEAN DEFAULT false,
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 约束：同一项目下版本名唯一
    UNIQUE(project_id, version_name),
    -- 约束：同一项目下分支名唯一
    UNIQUE(project_id, branch_name)
);

CREATE INDEX idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX idx_project_versions_active ON project_versions(project_id, is_active) WHERE is_active = true;

COMMENT ON TABLE project_versions IS '项目版本表，每个版本对应一个 Git 分支';
COMMENT ON COLUMN project_versions.id IS '版本唯一标识（UUID）';
COMMENT ON COLUMN project_versions.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN project_versions.version_name IS '版本名称，如 v1.0, v2.0';
COMMENT ON COLUMN project_versions.description IS '版本描述';
COMMENT ON COLUMN project_versions.idea IS '版本的需求/想法描述';
COMMENT ON COLUMN project_versions.branch_name IS 'Git 分支名，格式: {project-slug}/{version}';
COMMENT ON COLUMN project_versions.is_active IS '是否为当前激活版本，每个项目只能有一个激活版本';
COMMENT ON COLUMN project_versions.metadata IS '版本元数据（JSON格式）';
COMMENT ON COLUMN project_versions.created_at IS '创建时间';
COMMENT ON COLUMN project_versions.updated_at IS '更新时间';

-- ============================================================================
-- 7. llm_configs（统一 LLM 配置表）
-- ============================================================================
CREATE TABLE llm_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 配置范围
    config_scope VARCHAR(20) NOT NULL DEFAULT 'provider',
    provider VARCHAR(50) NOT NULL,
    role_profile VARCHAR(100),
    
    -- 连接配置
    api_key TEXT,
    base_url VARCHAR(500),
    
    -- 模型配置
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INT DEFAULT 8000,
    
    -- Cursor Agent 专用配置
    repository VARCHAR(500),
    branch_name VARCHAR(100),
    auto_create_pr BOOLEAN DEFAULT true,
    
    -- 状态
    is_active BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- 唯一约束：每个用户每个提供商（或角色）只能有一个配置
CREATE UNIQUE INDEX idx_llm_configs_unique ON llm_configs(user_id, provider, COALESCE(role_profile, ''))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_llm_configs_user_id ON llm_configs(user_id);
CREATE INDEX idx_llm_configs_provider ON llm_configs(provider);
CREATE INDEX idx_llm_configs_scope ON llm_configs(config_scope);
CREATE INDEX idx_llm_configs_role ON llm_configs(role_profile) WHERE role_profile IS NOT NULL;
CREATE INDEX idx_llm_configs_active ON llm_configs(user_id, is_active) WHERE is_active = true;

COMMENT ON TABLE llm_configs IS '统一 LLM 配置表（合并原 llm_configs、llm_provider_configs、role_llm_configs）';
COMMENT ON COLUMN llm_configs.id IS '配置唯一标识（UUID）';
COMMENT ON COLUMN llm_configs.user_id IS '所属用户ID（外键关联users表）';
COMMENT ON COLUMN llm_configs.config_scope IS '配置范围: provider（提供商级默认配置）, role（角色专属配置）';
COMMENT ON COLUMN llm_configs.provider IS 'LLM 提供商: openai, anthropic, zhipuai, ark, deepseek, cursor 等';
COMMENT ON COLUMN llm_configs.role_profile IS '角色类型，仅 config_scope=role 时有效';
COMMENT ON COLUMN llm_configs.api_key IS 'API密钥（加密存储）';
COMMENT ON COLUMN llm_configs.base_url IS 'API基础URL地址';
COMMENT ON COLUMN llm_configs.model IS '模型名称，如 gpt-4, claude-3-opus 等';
COMMENT ON COLUMN llm_configs.temperature IS '温度参数（0.0-2.0），控制输出的随机性';
COMMENT ON COLUMN llm_configs.max_tokens IS '最大token数';
COMMENT ON COLUMN llm_configs.repository IS 'GitHub 仓库 URL（Cursor Agent 专用）';
COMMENT ON COLUMN llm_configs.branch_name IS '分支名称（Cursor Agent 专用）';
COMMENT ON COLUMN llm_configs.auto_create_pr IS '是否自动创建PR（Cursor Agent 专用）';
COMMENT ON COLUMN llm_configs.is_active IS '是否为激活的默认配置';
COMMENT ON COLUMN llm_configs.created_at IS '创建时间';
COMMENT ON COLUMN llm_configs.updated_at IS '更新时间';
COMMENT ON COLUMN llm_configs.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 8. prompt_configs（Prompt 模板配置表）
-- ============================================================================
CREATE TABLE prompt_configs (
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

CREATE INDEX idx_prompt_configs_user_id ON prompt_configs(user_id);
CREATE INDEX idx_prompt_configs_type ON prompt_configs(prompt_type);
CREATE INDEX idx_prompt_configs_active ON prompt_configs(is_active) WHERE is_active = true;

COMMENT ON TABLE prompt_configs IS 'Prompt 模板配置表';
COMMENT ON COLUMN prompt_configs.id IS '配置唯一标识（UUID）';
COMMENT ON COLUMN prompt_configs.user_id IS '所属用户ID（外键关联users表）';
COMMENT ON COLUMN prompt_configs.prompt_type IS '提示类型: mrd, prd, design, code, test, task';
COMMENT ON COLUMN prompt_configs.prompt_key IS '提示键: system_prompt（系统提示）, template（模板）, review_prompt（评审提示） 等';
COMMENT ON COLUMN prompt_configs.content IS 'Prompt 内容';
COMMENT ON COLUMN prompt_configs.description IS '配置描述';
COMMENT ON COLUMN prompt_configs.is_active IS '是否激活（true表示可用）';
COMMENT ON COLUMN prompt_configs.created_at IS '创建时间';
COMMENT ON COLUMN prompt_configs.updated_at IS '更新时间';
COMMENT ON COLUMN prompt_configs.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 9. roles（角色运行实例表）
-- ============================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 角色标识
    profile VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- 角色配置
    goal TEXT,
    constraints TEXT,
    description TEXT,
    
    -- 运行状态
    is_idle BOOLEAN DEFAULT true,
    react_mode VARCHAR(20) DEFAULT 'react',
    
    -- Action 配置
    actions_list JSONB DEFAULT '[]',
    watch_actions JSONB DEFAULT '[]',
    
    -- 运行时状态（序列化的 RoleContext）
    state JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, profile)
);

CREATE INDEX idx_roles_project_id ON roles(project_id);
CREATE INDEX idx_roles_profile ON roles(profile);

COMMENT ON TABLE roles IS '角色运行实例表';
COMMENT ON COLUMN roles.id IS '角色实例唯一标识（UUID）';
COMMENT ON COLUMN roles.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN roles.profile IS '角色类型: ProductManager（产品经理）, Architect（架构师）, Engineer（工程师）, QAEngineer（测试工程师） 等';
COMMENT ON COLUMN roles.name IS '角色名称';
COMMENT ON COLUMN roles.goal IS '角色目标描述';
COMMENT ON COLUMN roles.constraints IS '角色约束条件';
COMMENT ON COLUMN roles.description IS '角色详细描述';
COMMENT ON COLUMN roles.is_idle IS '是否空闲（true表示空闲，false表示正在工作）';
COMMENT ON COLUMN roles.react_mode IS '反应模式: react（反应式）, by_order（按顺序）, plan_and_act（计划并执行）';
COMMENT ON COLUMN roles.actions_list IS '可执行的 Action 列表（JSON数组）';
COMMENT ON COLUMN roles.watch_actions IS '订阅的 Action 列表（JSON数组）';
COMMENT ON COLUMN roles.state IS '序列化的 RoleContext 数据（JSON格式）';
COMMENT ON COLUMN roles.created_at IS '创建时间';
COMMENT ON COLUMN roles.updated_at IS '更新时间';

-- ============================================================================
-- 10. messages（消息记录表）
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    message_uuid UUID NOT NULL UNIQUE,
    role_profile VARCHAR(100),
    
    -- 消息内容
    content TEXT NOT NULL,
    instruct_content JSONB,
    
    -- 消息元信息
    role_type VARCHAR(50) NOT NULL,
    cause_by VARCHAR(100) NOT NULL,
    sent_from VARCHAR(100) NOT NULL,
    send_to JSONB NOT NULL DEFAULT '[]',
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_role_profile ON messages(role_profile);
CREATE INDEX idx_messages_cause_by ON messages(cause_by);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

COMMENT ON TABLE messages IS '消息记录表';
COMMENT ON COLUMN messages.id IS '消息唯一标识（UUID）';
COMMENT ON COLUMN messages.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN messages.message_uuid IS '消息业务 UUID（用于业务逻辑关联）';
COMMENT ON COLUMN messages.role_profile IS '发送者角色类型，user 表示用户消息';
COMMENT ON COLUMN messages.content IS '消息内容';
COMMENT ON COLUMN messages.instruct_content IS '结构化指令内容（JSON格式）';
COMMENT ON COLUMN messages.role_type IS '消息角色: system（系统消息）, user（用户消息）, assistant（助手消息）';
COMMENT ON COLUMN messages.cause_by IS '触发此消息的 Action 类名';
COMMENT ON COLUMN messages.sent_from IS '发送者标识';
COMMENT ON COLUMN messages.send_to IS '接收者列表（JSON数组）';
COMMENT ON COLUMN messages.metadata IS '消息元数据（JSON格式）';
COMMENT ON COLUMN messages.created_at IS '创建时间';

-- ============================================================================
-- 11. action_logs（行动执行日志表，原 actions 表改名）
-- ============================================================================
CREATE TABLE action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    
    action_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    
    input_data JSONB,
    output_data JSONB,
    
    duration_ms INT,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_action_logs_project_id ON action_logs(project_id);
CREATE INDEX idx_action_logs_role_id ON action_logs(role_id);
CREATE INDEX idx_action_logs_action_type ON action_logs(action_type);
CREATE INDEX idx_action_logs_status ON action_logs(status);
CREATE INDEX idx_action_logs_created_at ON action_logs(created_at DESC);

COMMENT ON TABLE action_logs IS '行动执行日志表（原 actions 表）';
COMMENT ON COLUMN action_logs.id IS '日志唯一标识（UUID）';
COMMENT ON COLUMN action_logs.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN action_logs.role_id IS '执行角色ID（外键关联roles表，可为NULL）';
COMMENT ON COLUMN action_logs.message_id IS '关联消息ID（外键关联messages表，可为NULL）';
COMMENT ON COLUMN action_logs.action_type IS 'Action 类名: WritePRD（编写PRD）, WriteDesign（编写设计）, WriteCode（编写代码） 等';
COMMENT ON COLUMN action_logs.status IS '执行状态: pending（待处理）, running（执行中）, completed（已完成）, failed（失败）';
COMMENT ON COLUMN action_logs.input_data IS '输入数据（JSON格式）';
COMMENT ON COLUMN action_logs.output_data IS '输出数据（JSON格式）';
COMMENT ON COLUMN action_logs.duration_ms IS '执行时长（毫秒）';
COMMENT ON COLUMN action_logs.error_message IS '错误信息（如果执行失败）';
COMMENT ON COLUMN action_logs.created_at IS '创建时间';

-- ============================================================================
-- 12. documents（文档表，支持版本管理）
-- ============================================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    storage_path VARCHAR(500),
    
    -- 版本管理
    version INT DEFAULT 1,
    parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_doc_type ON documents(doc_type);
CREATE INDEX idx_documents_version ON documents(project_id, doc_type, version);
CREATE INDEX idx_documents_parent_id ON documents(parent_id);
CREATE INDEX idx_documents_is_deleted ON documents(is_deleted) WHERE is_deleted = FALSE;

COMMENT ON TABLE documents IS '文档表（支持版本管理）';
COMMENT ON COLUMN documents.id IS '文档唯一标识（UUID）';
COMMENT ON COLUMN documents.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN documents.filename IS '文件名';
COMMENT ON COLUMN documents.doc_type IS '文档类型: mrd（市场需求文档）, prd（产品需求文档）, design（设计文档）, code（代码文档）, test（测试文档）, readme（说明文档）, other（其他）';
COMMENT ON COLUMN documents.content IS '文档内容';
COMMENT ON COLUMN documents.storage_path IS '外部存储路径（如果文档存储在外部系统）';
COMMENT ON COLUMN documents.version IS '版本号，从1开始递增';
COMMENT ON COLUMN documents.parent_id IS '父版本ID，形成版本链（自引用）';
COMMENT ON COLUMN documents.is_deleted IS '是否已删除（false表示未删除）';
COMMENT ON COLUMN documents.metadata IS '文档元数据（JSON格式）';
COMMENT ON COLUMN documents.created_at IS '创建时间';
COMMENT ON COLUMN documents.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 13. cost_records（LLM 调用成本记录表）
-- ============================================================================
CREATE TABLE cost_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    total_tokens INT NOT NULL,
    cost DECIMAL(10,6) NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cost_records_project_id ON cost_records(project_id);
CREATE INDEX idx_cost_records_role_id ON cost_records(role_id);
CREATE INDEX idx_cost_records_created_at ON cost_records(created_at DESC);
CREATE INDEX idx_cost_records_provider ON cost_records(provider);

COMMENT ON TABLE cost_records IS 'LLM 调用成本记录表';
COMMENT ON COLUMN cost_records.id IS '记录唯一标识（UUID）';
COMMENT ON COLUMN cost_records.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN cost_records.role_id IS '调用角色ID（外键关联roles表，可为NULL）';
COMMENT ON COLUMN cost_records.provider IS 'LLM 提供商名称';
COMMENT ON COLUMN cost_records.model IS '模型名称';
COMMENT ON COLUMN cost_records.prompt_tokens IS 'Prompt token数量';
COMMENT ON COLUMN cost_records.completion_tokens IS 'Completion token数量';
COMMENT ON COLUMN cost_records.total_tokens IS '总token数量';
COMMENT ON COLUMN cost_records.cost IS '成本（美元），精度到小数点后6位';
COMMENT ON COLUMN cost_records.created_at IS '创建时间';

-- ============================================================================
-- 14. memories（角色长期记忆表）
-- ============================================================================
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    memory_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

CREATE INDEX idx_memories_role_id ON memories(role_id);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_expires_at ON memories(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE memories IS '角色长期记忆表';
COMMENT ON COLUMN memories.id IS '记忆唯一标识（UUID）';
COMMENT ON COLUMN memories.role_id IS '所属角色ID（外键关联roles表）';
COMMENT ON COLUMN memories.memory_type IS '记忆类型，用于分类不同类型的记忆';
COMMENT ON COLUMN memories.content IS '记忆内容';
COMMENT ON COLUMN memories.metadata IS '记忆元数据（JSON格式）';
COMMENT ON COLUMN memories.created_at IS '创建时间';
COMMENT ON COLUMN memories.expires_at IS '过期时间（可选，NULL表示永不过期）';

-- ============================================================================
-- 15. embeddings（向量嵌入表）
-- ============================================================================
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    
    vector JSONB NOT NULL,
    model VARCHAR(100) NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_memory_id ON embeddings(memory_id);

COMMENT ON TABLE embeddings IS '向量嵌入表（用于语义搜索）';
COMMENT ON COLUMN embeddings.id IS '向量唯一标识（UUID）';
COMMENT ON COLUMN embeddings.memory_id IS '所属记忆ID（外键关联memories表）';
COMMENT ON COLUMN embeddings.vector IS '向量数据（JSONB格式，未来可迁移到 pgvector 扩展）';
COMMENT ON COLUMN embeddings.model IS '嵌入模型名称';
COMMENT ON COLUMN embeddings.created_at IS '创建时间';

-- ============================================================================
-- 16. knowledge_base（知识库文档表）
-- ============================================================================
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_knowledge_base_project_id ON knowledge_base(project_id);
CREATE INDEX idx_knowledge_base_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_base_active ON knowledge_base(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE knowledge_base IS '知识库文档表（用于 RAG 检索）';
COMMENT ON COLUMN knowledge_base.id IS '文档唯一标识（UUID）';
COMMENT ON COLUMN knowledge_base.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN knowledge_base.title IS '文档标题';
COMMENT ON COLUMN knowledge_base.content IS '文档内容';
COMMENT ON COLUMN knowledge_base.description IS '文档描述';
COMMENT ON COLUMN knowledge_base.tags IS '标签数组，用于分类和过滤';
COMMENT ON COLUMN knowledge_base.metadata IS '文档元数据（JSON格式）';
COMMENT ON COLUMN knowledge_base.is_active IS '是否激活（true表示可用）';
COMMENT ON COLUMN knowledge_base.created_by IS '创建者标识';
COMMENT ON COLUMN knowledge_base.created_at IS '创建时间';
COMMENT ON COLUMN knowledge_base.updated_at IS '更新时间';
COMMENT ON COLUMN knowledge_base.deleted_at IS '软删除时间（NULL表示未删除）';

-- ============================================================================
-- 17. section_conversations（文档章节对话表）
-- ============================================================================
CREATE TABLE section_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    document_type VARCHAR(50) NOT NULL DEFAULT 'prd',
    section_number INT NOT NULL,
    version INT DEFAULT 1,
    
    messages JSONB NOT NULL DEFAULT '[]',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(project_id, document_type, section_number, version)
);

CREATE INDEX idx_section_conversations_project_id ON section_conversations(project_id);
CREATE INDEX idx_section_conversations_document_id ON section_conversations(document_id);
CREATE INDEX idx_section_conversations_lookup ON section_conversations(project_id, document_type, section_number, version);

COMMENT ON TABLE section_conversations IS '文档章节对话表';
COMMENT ON COLUMN section_conversations.id IS '对话唯一标识（UUID）';
COMMENT ON COLUMN section_conversations.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN section_conversations.document_id IS '关联文档ID（外键关联documents表，可为NULL）';
COMMENT ON COLUMN section_conversations.document_type IS '文档类型: prd（产品需求文档）, mrd（市场需求文档） 等';
COMMENT ON COLUMN section_conversations.section_number IS '章节编号';
COMMENT ON COLUMN section_conversations.version IS '版本号';
COMMENT ON COLUMN section_conversations.messages IS '对话消息数组（JSON格式）';
COMMENT ON COLUMN section_conversations.created_at IS '创建时间';
COMMENT ON COLUMN section_conversations.updated_at IS '更新时间';

-- ============================================================================
-- 18. application_workflows（应用工作流配置表）
-- ============================================================================
CREATE TABLE application_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    
    -- 工作流配置 JSON
    -- { roles: [{ profile, name, order, actions, watch_actions }] }
    workflow_config JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_application_workflows_app_id ON application_workflows(application_id);
CREATE UNIQUE INDEX idx_application_workflows_default ON application_workflows(application_id) WHERE is_default = true;

COMMENT ON TABLE application_workflows IS '应用工作流配置表';
COMMENT ON COLUMN application_workflows.id IS '工作流唯一标识（UUID）';
COMMENT ON COLUMN application_workflows.application_id IS '所属应用ID（外键关联applications表）';
COMMENT ON COLUMN application_workflows.name IS '工作流名称';
COMMENT ON COLUMN application_workflows.description IS '工作流描述';
COMMENT ON COLUMN application_workflows.is_default IS '是否为默认工作流（每个应用只能有一个）';
COMMENT ON COLUMN application_workflows.workflow_config IS '工作流配置 JSON: { roles: [{ profile, name, order, actions, watch_actions }] }';
COMMENT ON COLUMN application_workflows.created_at IS '创建时间';
COMMENT ON COLUMN application_workflows.updated_at IS '更新时间';

-- ============================================================================
-- 19. workflow_executions（工作流执行实例表）
-- ============================================================================
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_id UUID REFERENCES project_versions(id) ON DELETE CASCADE,
    
    -- 工作流快照（创建时固化）
    workflow_snapshot JSONB NOT NULL,
    
    -- 执行状态
    state VARCHAR(30) NOT NULL DEFAULT 'initialized',
    
    -- 当前位置 { roleIndex, actionIndex }
    current_position JSONB,
    
    -- 所有步骤状态数组
    steps JSONB NOT NULL DEFAULT '[]',
    
    -- 待确认信息
    pending_confirmation JSONB,
    
    -- 错误信息
    last_error JSONB,
    
    -- 执行上下文
    execution_context JSONB DEFAULT '{}',
    
    -- 乐观锁版本号
    version INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 每个项目的每个版本只能有一个执行记录
    UNIQUE(project_id, version_id)
);

CREATE INDEX idx_workflow_executions_project ON workflow_executions(project_id);
CREATE INDEX idx_workflow_executions_version ON workflow_executions(version_id);
CREATE INDEX idx_workflow_executions_state ON workflow_executions(state);
CREATE INDEX idx_workflow_executions_updated ON workflow_executions(updated_at DESC);

COMMENT ON TABLE workflow_executions IS '工作流执行实例表（统一状态管理）';
COMMENT ON COLUMN workflow_executions.id IS '执行实例唯一标识（UUID）';
COMMENT ON COLUMN workflow_executions.project_id IS '所属项目ID（外键关联projects表）';
COMMENT ON COLUMN workflow_executions.version_id IS '关联的项目版本ID（外键关联project_versions表）';
COMMENT ON COLUMN workflow_executions.workflow_snapshot IS '工作流配置快照（创建时固化，JSON格式）';
COMMENT ON COLUMN workflow_executions.state IS '工作流状态: initialized（已初始化）, running（运行中）, waiting_confirmation（等待确认）, paused（已暂停）, completed（已完成）, failed（失败）';
COMMENT ON COLUMN workflow_executions.current_position IS '当前执行位置: { roleIndex（角色索引）, actionIndex（动作索引） }';
COMMENT ON COLUMN workflow_executions.steps IS '所有步骤状态数组（JSON格式）';
COMMENT ON COLUMN workflow_executions.pending_confirmation IS '待确认信息（JSON格式）';
COMMENT ON COLUMN workflow_executions.last_error IS '最后错误信息（JSON格式）';
COMMENT ON COLUMN workflow_executions.execution_context IS '执行上下文（JSON格式）';
COMMENT ON COLUMN workflow_executions.version IS '乐观锁版本号（用于并发控制）';
COMMENT ON COLUMN workflow_executions.created_at IS '创建时间';
COMMENT ON COLUMN workflow_executions.updated_at IS '更新时间';

-- ============================================================================
-- 第四部分：创建触发器和函数
-- ============================================================================

-- 触发器函数：确保每个应用只有一个默认工作流
CREATE OR REPLACE FUNCTION ensure_single_default_workflow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE application_workflows
    SET is_default = false, updated_at = NOW()
    WHERE application_id = NEW.application_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_default_workflow
BEFORE INSERT OR UPDATE ON application_workflows
FOR EACH ROW EXECUTE FUNCTION ensure_single_default_workflow();

-- 触发器函数：确保每个项目只有一个激活版本
CREATE OR REPLACE FUNCTION ensure_single_active_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE project_versions
    SET is_active = false, updated_at = NOW()
    WHERE project_id = NEW.project_id AND id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_single_active_version
BEFORE INSERT OR UPDATE ON project_versions
FOR EACH ROW EXECUTE FUNCTION ensure_single_active_version();

-- ============================================================================
-- 第五部分：初始化数据
-- ============================================================================

-- 插入默认用户（开发环境）
INSERT INTO users (id, username, email, password_hash, full_name, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin',
    'admin@mind2build.com',
    '$2b$10$dummy.hash.for.development.only',
    'Admin User',
    'active'
) ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 完成提示
-- ============================================================================
-- 完整 Schema 创建完成！
-- 表数量: 19
-- 主要特性:
--   1. 所有表都包含完整的字段注释
--   2. 支持软删除（deleted_at字段）
--   3. 支持版本管理（project_versions表）
--   4. 统一的状态管理（workflow_executions表）
--   5. 完整的索引优化
--   6. 触发器确保数据一致性

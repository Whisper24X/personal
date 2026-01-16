-- ============================================================================
-- Migration: Role and Action Definitions with Application Workflow Support
-- 创建日期: 2025-01-XX
-- ============================================================================

-- 1.1 role_definitions (角色定义表)
CREATE TABLE IF NOT EXISTS role_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile VARCHAR(100) UNIQUE NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_role_definitions_profile ON role_definitions(profile);
CREATE INDEX IF NOT EXISTS idx_role_definitions_is_active ON role_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_role_definitions_class_name ON role_definitions(class_name);

COMMENT ON TABLE role_definitions IS '角色定义表，存储所有可用角色的元数据定义';
COMMENT ON COLUMN role_definitions.profile IS '角色类型（唯一标识），如 ProductManager';
COMMENT ON COLUMN role_definitions.class_name IS '对应的代码类名，如 ProductManager';
COMMENT ON COLUMN role_definitions.is_active IS '是否激活，可用于启用/禁用角色';

-- 1.2 action_definitions (Action定义表)
CREATE TABLE IF NOT EXISTS action_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200),
  description TEXT,
  class_name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_definitions_name ON action_definitions(name);
CREATE INDEX IF NOT EXISTS idx_action_definitions_category ON action_definitions(category);
CREATE INDEX IF NOT EXISTS idx_action_definitions_is_active ON action_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_action_definitions_class_name ON action_definitions(class_name);

COMMENT ON TABLE action_definitions IS 'Action定义表，存储所有可用Action的元数据定义';
COMMENT ON COLUMN action_definitions.name IS 'Action名称（唯一标识），如 WritePRD';
COMMENT ON COLUMN action_definitions.class_name IS '对应的代码类名，如 WritePRD';
COMMENT ON COLUMN action_definitions.category IS 'Action分类，如 document_writing, review, improvement';

-- 1.3 application_workflows (应用工作流配置表)
CREATE TABLE IF NOT EXISTS application_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  workflow_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_application_workflows_application_id ON application_workflows(application_id);
CREATE INDEX IF NOT EXISTS idx_application_workflows_is_default ON application_workflows(application_id, is_default) WHERE is_default = true;

COMMENT ON TABLE application_workflows IS '应用工作流配置表，存储每个应用的工作流配置';
COMMENT ON COLUMN application_workflows.workflow_config IS '工作流配置（JSONB），包含roles数组，每个角色包含profile、name、order、actions、watch_actions等';
COMMENT ON COLUMN application_workflows.is_default IS '是否为默认工作流，每个应用只能有一个默认工作流';

-- 1.4 application_roles (应用-角色关联表，用于快速查询)
CREATE TABLE IF NOT EXISTS application_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  role_profile VARCHAR(100) NOT NULL REFERENCES role_definitions(profile) ON DELETE CASCADE,
  workflow_id UUID REFERENCES application_workflows(id) ON DELETE CASCADE,
  "order" INT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(application_id, workflow_id, role_profile)
);

CREATE INDEX IF NOT EXISTS idx_application_roles_application_id ON application_roles(application_id);
CREATE INDEX IF NOT EXISTS idx_application_roles_workflow_id ON application_roles(workflow_id);
CREATE INDEX IF NOT EXISTS idx_application_roles_role_profile ON application_roles(role_profile);

COMMENT ON TABLE application_roles IS '应用-角色关联表，存储应用可用的角色列表（用于快速查询）';
COMMENT ON COLUMN application_roles."order" IS '在工作流中的执行顺序';

-- 1.5 application_actions (应用-Action关联表，用于快速查询)
CREATE TABLE IF NOT EXISTS application_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  action_name VARCHAR(100) NOT NULL REFERENCES action_definitions(name) ON DELETE CASCADE,
  role_profile VARCHAR(100) NOT NULL REFERENCES role_definitions(profile) ON DELETE CASCADE,
  workflow_id UUID REFERENCES application_workflows(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(application_id, workflow_id, role_profile, action_name)
);

CREATE INDEX IF NOT EXISTS idx_application_actions_application_id ON application_actions(application_id);
CREATE INDEX IF NOT EXISTS idx_application_actions_workflow_id ON application_actions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_application_actions_action_name ON application_actions(action_name);
CREATE INDEX IF NOT EXISTS idx_application_actions_role_profile ON application_actions(role_profile);

COMMENT ON TABLE application_actions IS '应用-Action关联表，存储应用可用的Action列表（用于快速查询）';
COMMENT ON COLUMN application_actions.role_profile IS '所属角色类型';

-- 添加触发器：确保每个应用只有一个默认工作流
CREATE OR REPLACE FUNCTION ensure_single_default_workflow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- 将同一应用的其他工作流的is_default设置为false
    UPDATE application_workflows
    SET is_default = false, updated_at = NOW()
    WHERE application_id = NEW.application_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_workflow
BEFORE INSERT OR UPDATE ON application_workflows
FOR EACH ROW
EXECUTE FUNCTION ensure_single_default_workflow();

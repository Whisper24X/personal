-- ============================================================================
-- Migration: System Default Workflow Templates
-- 创建日期: 2025-01-XX
-- ============================================================================

-- 系统默认工作流模板表
-- 用于存储系统级别的默认工作流配置，支持动态管理默认工作流模板
CREATE TABLE IF NOT EXISTS system_default_workflow_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  workflow_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_default_workflow_templates_active 
ON system_default_workflow_templates(is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_system_default_workflow_templates_name 
ON system_default_workflow_templates(name);

COMMENT ON TABLE system_default_workflow_templates IS '系统默认工作流模板表，存储系统级别的默认工作流配置';
COMMENT ON COLUMN system_default_workflow_templates.name IS '模板名称，如 default';
COMMENT ON COLUMN system_default_workflow_templates.workflow_config IS '工作流配置（JSONB格式），包含角色和Action配置';
COMMENT ON COLUMN system_default_workflow_templates.is_active IS '是否激活，只有激活的模板才会被使用';

-- ============================================================================
-- 002_add_version_to_workflow_executions.sql
-- 为 workflow_executions 表添加 version_id 字段
-- 创建日期: 2026-01-25
-- ============================================================================

-- 1. 先删除旧的唯一约束（project_id）
ALTER TABLE workflow_executions DROP CONSTRAINT IF EXISTS workflow_executions_project_id_key;

-- 2. 添加 version_id 列（允许 NULL 用于迁移）
ALTER TABLE workflow_executions 
ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES project_versions(id) ON DELETE CASCADE;

-- 3. 添加新的唯一约束（project_id + version_id）
-- 每个项目的每个版本只能有一个执行记录
ALTER TABLE workflow_executions 
ADD CONSTRAINT workflow_executions_project_version_unique UNIQUE(project_id, version_id);

-- 4. 添加索引
CREATE INDEX IF NOT EXISTS idx_workflow_executions_version ON workflow_executions(version_id);

-- 注释
COMMENT ON COLUMN workflow_executions.version_id IS '关联的项目版本ID，必需字段';

-- ============================================================================
-- 完成提示
-- ============================================================================
-- workflow_executions 表已更新，添加了 version_id 字段
-- 注意：现有数据的 version_id 为 NULL，需要手动迁移或删除

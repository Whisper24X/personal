-- ============================================================================
-- 003_add_idea_to_versions.sql
-- 将 idea 字段从 projects 移至 project_versions
-- 创建日期: 2026-01-25
-- ============================================================================

-- 1. 为 project_versions 添加 idea 字段
ALTER TABLE project_versions 
ADD COLUMN IF NOT EXISTS idea TEXT;

-- 2. 将 projects 表的 idea 改为可选（允许 NULL）
ALTER TABLE projects 
ALTER COLUMN idea DROP NOT NULL;

-- 注释
COMMENT ON COLUMN project_versions.idea IS '版本的需求/想法描述';

-- ============================================================================
-- 完成提示
-- ============================================================================
-- project_versions 表已添加 idea 字段
-- projects 表的 idea 字段已改为可选

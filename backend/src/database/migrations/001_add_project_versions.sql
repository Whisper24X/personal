-- ============================================================================
-- 001_add_project_versions.sql
-- 项目版本表，每个版本对应一个 Git 分支
-- 创建日期: 2026-01-25
-- ============================================================================

-- 项目版本表
CREATE TABLE IF NOT EXISTS project_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 版本信息
    version_name VARCHAR(50) NOT NULL,        -- 如 v1.0, v1.1, v2.0
    description TEXT,                         -- 版本描述
    
    -- Git 分支信息
    branch_name VARCHAR(200) NOT NULL,        -- 自动生成: {project-slug}/{version}
    
    -- 状态
    is_active BOOLEAN DEFAULT false,          -- 是否为当前激活版本
    
    -- 元数据
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 约束：同一项目下版本名唯一
    UNIQUE(project_id, version_name),
    -- 约束：同一项目下分支名唯一
    UNIQUE(project_id, branch_name)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_active ON project_versions(project_id, is_active) WHERE is_active = true;

-- 注释
COMMENT ON TABLE project_versions IS '项目版本表，每个版本对应一个 Git 分支';
COMMENT ON COLUMN project_versions.version_name IS '版本名称，如 v1.0, v2.0';
COMMENT ON COLUMN project_versions.branch_name IS 'Git 分支名，格式: {project-slug}/{version}';
COMMENT ON COLUMN project_versions.is_active IS '是否为当前激活版本，每个项目只能有一个激活版本';
COMMENT ON COLUMN project_versions.metadata IS '版本元数据（JSON）';

-- ============================================================================
-- 触发器：确保每个项目只有一个激活版本
-- ============================================================================
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

DROP TRIGGER IF EXISTS trigger_single_active_version ON project_versions;
CREATE TRIGGER trigger_single_active_version
BEFORE INSERT OR UPDATE ON project_versions
FOR EACH ROW EXECUTE FUNCTION ensure_single_active_version();

-- ============================================================================
-- 完成提示
-- ============================================================================
-- project_versions 表创建完成！

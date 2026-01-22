-- Migration: 011_workflow_executions.sql
-- Description: Create workflow_executions table for simplified state management
-- This table consolidates state from multiple tables into a single source of truth

-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- 工作流配置快照（创建时固化，执行期间不变）
  workflow_snapshot JSONB NOT NULL,
  
  -- 整体状态（状态机的当前状态）
  -- Values: initialized, running, waiting_confirmation, paused, completed, failed
  state VARCHAR(30) NOT NULL DEFAULT 'initialized',
  
  -- 当前执行位置 { roleIndex: number, actionIndex: number }
  current_position JSONB,
  
  -- 所有步骤状态（扁平化数组）
  -- Array of: { role, action, roleIndex, actionIndex, state, retryCount, startedAt, completedAt, error }
  steps JSONB NOT NULL DEFAULT '[]',
  
  -- 待确认信息
  -- { role, action, content, outputFiles, instructContent, createdAt }
  pending_confirmation JSONB,
  
  -- 错误信息
  -- { message, stack, timestamp }
  last_error JSONB,
  
  -- 执行上下文（用于传递数据）
  execution_context JSONB DEFAULT '{}',
  
  -- 版本号（乐观锁，用于并发控制）
  version INT NOT NULL DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- 每个项目只能有一个执行实例
  UNIQUE(project_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workflow_executions_project ON workflow_executions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_state ON workflow_executions(state);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_updated ON workflow_executions(updated_at);

-- Add comments
COMMENT ON TABLE workflow_executions IS '工作流执行实例表，统一管理所有工作流状态';
COMMENT ON COLUMN workflow_executions.state IS '工作流状态: initialized, running, waiting_confirmation, paused, completed, failed';
COMMENT ON COLUMN workflow_executions.workflow_snapshot IS '工作流配置快照，创建时固化';
COMMENT ON COLUMN workflow_executions.current_position IS '当前执行位置: { roleIndex, actionIndex }';
COMMENT ON COLUMN workflow_executions.steps IS '所有步骤状态数组';
COMMENT ON COLUMN workflow_executions.pending_confirmation IS '待用户确认的信息';
COMMENT ON COLUMN workflow_executions.last_error IS '最后一次错误信息';
COMMENT ON COLUMN workflow_executions.execution_context IS '执行上下文，用于步骤间数据传递';
COMMENT ON COLUMN workflow_executions.version IS '乐观锁版本号，用于并发控制';

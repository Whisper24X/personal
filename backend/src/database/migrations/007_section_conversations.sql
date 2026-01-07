-- Section Conversations Migration
-- Store conversation history for section adjustments in database

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

COMMENT ON TABLE section_conversations IS 'Stores conversation history for section adjustments';
COMMENT ON COLUMN section_conversations.messages IS 'Array of conversation messages with role, content, and timestamp';


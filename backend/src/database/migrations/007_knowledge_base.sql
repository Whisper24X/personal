-- Create knowledge_base table
-- Used for storing project-level knowledge base documents

CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    tags TEXT[], -- Array of tags for categorization
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

COMMENT ON TABLE knowledge_base IS 'Project-level knowledge base documents for RAG retrieval';
COMMENT ON COLUMN knowledge_base.title IS 'Title of the knowledge base document';
COMMENT ON COLUMN knowledge_base.content IS 'Content of the knowledge base document';
COMMENT ON COLUMN knowledge_base.tags IS 'Tags for categorizing and filtering documents';
COMMENT ON COLUMN knowledge_base.is_active IS 'Whether the document is active and searchable';


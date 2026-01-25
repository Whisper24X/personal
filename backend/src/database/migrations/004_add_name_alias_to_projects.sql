-- Add name_alias column to projects table
-- This field stores the English alias of the project name, used for Git branch names

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS name_alias VARCHAR(200);

-- Add comment
COMMENT ON COLUMN projects.name_alias IS '项目英文别名，用于生成 Git 分支名';

/**
 * Seed Data Script for Schema V2
 * Initializes role definitions, action definitions, and default data
 * 
 * Usage: npx ts-node src/database/migrations/seed_data_v2.ts
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Import from single source of truth
import { roleDefinitions, actionDefinitions, defaultWorkflowConfig } from '../../services/defaultWorkflowConfig';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function seedData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🌱 Starting Seed Data Script for Schema V2...');

  try {
    // Step 1: Insert role definitions
    console.log('\n📦 Step 1: Inserting role definitions...');
    for (const role of roleDefinitions) {
      await pool.query(
        `INSERT INTO role_definitions (profile, name, display_name, goal, constraints, description, class_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (profile) DO UPDATE SET
           name = EXCLUDED.name,
           display_name = EXCLUDED.display_name,
           goal = EXCLUDED.goal,
           constraints = EXCLUDED.constraints,
           description = EXCLUDED.description,
           class_name = EXCLUDED.class_name,
           updated_at = NOW()`,
        [role.profile, role.name, role.display_name, role.goal, role.constraints, role.description, role.class_name]
      );
    }
    console.log(`✅ Inserted ${roleDefinitions.length} role definitions`);

    // Step 2: Insert action definitions
    console.log('\n📦 Step 2: Inserting action definitions...');
    for (const action of actionDefinitions) {
      await pool.query(
        `INSERT INTO action_definitions (name, display_name, description, class_name, category)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           class_name = EXCLUDED.class_name,
           category = EXCLUDED.category,
           updated_at = NOW()`,
        [action.name, action.display_name, action.description, action.class_name, action.category]
      );
    }
    console.log(`✅ Inserted ${actionDefinitions.length} action definitions`);

    // Step 3: Ensure default user exists
    console.log('\n📦 Step 3: Ensuring default user exists...');
    const userResult = await pool.query(
      `INSERT INTO users (id, username, email, password_hash, full_name, status)
       VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'admin@mind2build.com', '$2b$10$dummy.hash', 'Admin User', 'active')
       ON CONFLICT (username) DO NOTHING
       RETURNING id`
    );
    const userId = userResult.rows[0]?.id || '00000000-0000-0000-0000-000000000001';
    console.log(`✅ Default user ensured: ${userId}`);

    // Step 4: Create default application
    console.log('\n📦 Step 4: Creating default application...');
    const appResult = await pool.query(
      `INSERT INTO applications (id, user_id, name, description)
       VALUES ('00000000-0000-0000-0000-000000000002', $1, '默认应用', '系统默认应用')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [userId]
    );
    const appId = appResult.rows[0]?.id || '00000000-0000-0000-0000-000000000002';
    console.log(`✅ Default application ensured: ${appId}`);

    // Step 5: Create or update default workflow
    console.log('\n📦 Step 5: Creating or updating default workflow...');
    const workflowResult = await pool.query(
      `INSERT INTO application_workflows (id, application_id, name, description, is_default, workflow_config)
       VALUES ('00000000-0000-0000-0000-000000000003', $1, '默认工作流', '系统默认工作流配置', true, $2)
       ON CONFLICT (id) DO UPDATE SET
         workflow_config = EXCLUDED.workflow_config,
         updated_at = NOW()
       RETURNING id`,
      [appId, JSON.stringify(defaultWorkflowConfig)]
    );
    
    // Also update any other default workflows to ensure consistency
    await pool.query(
      `UPDATE application_workflows 
       SET workflow_config = $1, updated_at = NOW()
       WHERE is_default = true AND id != '00000000-0000-0000-0000-000000000003'`,
      [JSON.stringify(defaultWorkflowConfig)]
    );
    
    console.log('✅ Default workflow created or updated');

    // Step 6: Verify data
    console.log('\n📦 Step 6: Verifying seed data...');
    const roleCount = await pool.query('SELECT COUNT(*) FROM role_definitions');
    const actionCount = await pool.query('SELECT COUNT(*) FROM action_definitions');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const appCount = await pool.query('SELECT COUNT(*) FROM applications');
    const workflowCount = await pool.query('SELECT COUNT(*) FROM application_workflows');

    console.log(`   - Role definitions: ${roleCount.rows[0].count}`);
    console.log(`   - Action definitions: ${actionCount.rows[0].count}`);
    console.log(`   - Users: ${userCount.rows[0].count}`);
    console.log(`   - Applications: ${appCount.rows[0].count}`);
    console.log(`   - Workflows: ${workflowCount.rows[0].count}`);

    console.log('\n🎉 Seed data script completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Seed data script failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedData();

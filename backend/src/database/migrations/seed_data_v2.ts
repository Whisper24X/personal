/**
 * Seed Data Script for Schema V2
 * Initializes role definitions, action definitions, and default data
 * 
 * Usage: npx ts-node src/database/migrations/seed_data_v2.ts
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Role definitions
const roleDefinitions = [
  {
    profile: 'ProductManager',
    name: 'Product Manager',
    display_name: '产品经理',
    goal: '基于用户需求编写产品需求文档（PRD）',
    constraints: '确保需求清晰、可实现、有商业价值',
    description: '负责理解用户需求，编写PRD，协调产品开发',
    class_name: 'ProductManager',
  },
  {
    profile: 'Architect',
    name: 'Architect',
    display_name: '架构师',
    goal: '设计系统架构，确保技术方案可行',
    constraints: '考虑性能、可扩展性、安全性',
    description: '负责系统架构设计，评审技术方案',
    class_name: 'Architect',
  },
  {
    profile: 'Engineer',
    name: 'Engineer',
    display_name: '工程师',
    goal: '实现代码，完成开发任务',
    constraints: '遵循编码规范，确保代码质量',
    description: '负责代码实现、单元测试、代码审查',
    class_name: 'Engineer',
  },
  {
    profile: 'QAEngineer',
    name: 'QA Engineer',
    display_name: 'QA工程师',
    goal: '编写测试用例，执行测试',
    constraints: '确保测试覆盖率，发现潜在问题',
    description: '负责测试计划、测试用例、自动化测试',
    class_name: 'QAEngineer',
  },
  {
    profile: 'ProjectManager',
    name: 'Project Manager',
    display_name: '项目经理',
    goal: '协调团队，管理项目进度',
    constraints: '平衡质量、时间、成本',
    description: '负责项目规划、进度跟踪、风险管理',
    class_name: 'ProjectManager',
  },
  {
    profile: 'TeamLeader',
    name: 'Team Leader',
    display_name: '团队负责人',
    goal: '领导团队完成目标',
    constraints: '合理分配任务，激励团队',
    description: '负责团队管理、任务分配、技术决策',
    class_name: 'TeamLeader',
  },
  {
    profile: 'Salesperson',
    name: 'Salesperson',
    display_name: '销售',
    goal: '理解客户需求，促成交易',
    constraints: '诚实守信，长期合作',
    description: '负责客户沟通、需求收集、商务谈判',
    class_name: 'Salesperson',
  },
  {
    profile: 'DataAnalyst',
    name: 'Data Analyst',
    display_name: '数据分析师',
    goal: '分析数据，提供洞察',
    constraints: '确保数据准确性和时效性',
    description: '负责数据分析、报表制作、数据可视化',
    class_name: 'DataAnalyst',
  },
  {
    profile: 'AutomationEngineer',
    name: 'Automation Engineer',
    display_name: '自动化工程师',
    goal: '实现流程自动化',
    constraints: '确保自动化稳定可靠',
    description: '负责自动化脚本、CI/CD、基础设施',
    class_name: 'AutomationEngineer',
  },
];

// Action definitions
const actionDefinitions = [
  // Document Writing
  { name: 'WriteMRD', display_name: '编写MRD', description: '编写市场需求文档', class_name: 'WriteMRD', category: 'document_writing' },
  { name: 'WritePRD', display_name: '编写PRD', description: '编写产品需求文档', class_name: 'WritePRD', category: 'document_writing' },
  { name: 'WriteDesign', display_name: '编写设计文档', description: '编写系统设计文档', class_name: 'WriteDesign', category: 'document_writing' },
  { name: 'WriteCode', display_name: '编写代码', description: '实现代码', class_name: 'WriteCode', category: 'document_writing' },
  { name: 'WriteTest', display_name: '编写测试', description: '编写测试用例和代码', class_name: 'WriteTest', category: 'document_writing' },
  { name: 'WriteTestPlan', display_name: '编写测试计划', description: '编写测试计划文档', class_name: 'WriteTestPlan', category: 'document_writing' },
  { name: 'WriteSubProjectDesign', display_name: '编写子项目设计', description: '编写子项目设计文档', class_name: 'WriteSubProjectDesign', category: 'document_writing' },

  // Reviews
  { name: 'MRDReview', display_name: 'MRD评审', description: '评审市场需求文档', class_name: 'MRDReview', category: 'review' },
  { name: 'PRDReview', display_name: 'PRD评审', description: '评审产品需求文档', class_name: 'PRDReview', category: 'review' },
  { name: 'DesignReview', display_name: '设计评审', description: '评审系统设计文档', class_name: 'DesignReview', category: 'review' },
  { name: 'CodeReview', display_name: '代码评审', description: '评审代码质量', class_name: 'CodeReview', category: 'review' },
  { name: 'TestReview', display_name: '测试评审', description: '评审测试用例', class_name: 'TestReview', category: 'review' },
  { name: 'TestCaseReview', display_name: '测试用例评审', description: '评审测试用例详情', class_name: 'TestCaseReview', category: 'review' },
  { name: 'TestabilityReview', display_name: '可测试性评审', description: '评审代码可测试性', class_name: 'TestabilityReview', category: 'review' },
  { name: 'SubProjectDesignReview', display_name: '子项目设计评审', description: '评审子项目设计', class_name: 'SubProjectDesignReview', category: 'review' },

  // Improvements
  { name: 'ImproveMRD', display_name: '改进MRD', description: '根据反馈改进MRD', class_name: 'ImproveMRD', category: 'improvement' },
  { name: 'ImprovePRD', display_name: '改进PRD', description: '根据反馈改进PRD', class_name: 'ImprovePRD', category: 'improvement' },
  { name: 'ImproveDesign', display_name: '改进设计', description: '根据反馈改进设计', class_name: 'ImproveDesign', category: 'improvement' },
  { name: 'ImproveTest', display_name: '改进测试', description: '根据反馈改进测试', class_name: 'ImproveTest', category: 'improvement' },
  { name: 'FixBug', display_name: '修复Bug', description: '修复代码缺陷', class_name: 'FixBug', category: 'improvement' },

  // Execution
  { name: 'RunCode', display_name: '运行代码', description: '执行代码运行', class_name: 'RunCode', category: 'execution' },
  { name: 'ExecuteSubtask', display_name: '执行子任务', description: '执行分解的子任务', class_name: 'ExecuteSubtask', category: 'execution' },
  { name: 'AutomationExecution', display_name: '自动化执行', description: '执行自动化任务', class_name: 'AutomationExecution', category: 'execution' },

  // Planning & Analysis
  { name: 'BreakdownTasks', display_name: '任务分解', description: '将大任务分解为子任务', class_name: 'BreakdownTasks', category: 'planning' },
  { name: 'AutomationPlanning', display_name: '自动化规划', description: '规划自动化方案', class_name: 'AutomationPlanning', category: 'planning' },
  { name: 'Coordinate', display_name: '协调', description: '协调团队工作', class_name: 'Coordinate', category: 'planning' },
  { name: 'DataAnalysis', display_name: '数据分析', description: '分析数据生成报告', class_name: 'DataAnalysis', category: 'analysis' },
  { name: 'SearchEnhancedQA', display_name: '搜索增强QA', description: '基于搜索的问答', class_name: 'SearchEnhancedQA', category: 'analysis' },
  { name: 'QAConclusion', display_name: 'QA结论', description: '生成QA结论报告', class_name: 'QAConclusion', category: 'analysis' },
  { name: 'CoverageQualityCheck', display_name: '覆盖率检查', description: '检查测试覆盖率', class_name: 'CoverageQualityCheck', category: 'analysis' },
];

// Default workflow configuration
// 配置与角色定义保持一致
const defaultWorkflowConfig = {
  roles: [
    {
      profile: 'Salesperson',
      name: 'Salesperson',
      order: 0,
      actions: ['WriteMRD', 'MRDReview', 'ImproveMRD'],
      watch_actions: ['User'],
    },
    {
      profile: 'ProductManager',
      name: 'Product Manager',
      order: 1,
      actions: ['WritePRD', 'PRDReview', 'ImprovePRD'],
      watch_actions: ['WriteMRD', 'ImproveMRD'],
    },
    {
      profile: 'QAEngineer',
      name: 'QA Engineer',
      order: 2,
      actions: ['WriteTestPlan', 'WriteTest', 'TestCaseReview'],
      watch_actions: ['WritePRD', 'ImprovePRD'],
    },
    {
      profile: 'Architect',
      name: 'Architect',
      order: 3,
      actions: ['WriteDesign', 'DesignReview', 'ImproveDesign'],
      watch_actions: ['WritePRD', 'ImprovePRD'],
    },
    {
      profile: 'ProjectManager',
      name: 'Project Manager',
      order: 4,
      actions: ['BreakdownTasks'],
      watch_actions: ['WritePRD', 'WriteDesign'],
    },
    {
      profile: 'Engineer',
      name: 'Engineer',
      order: 5,
      actions: ['WriteCode'],
      watch_actions: ['WritePRD', 'WriteDesign', 'BreakdownTasks'],
    },
    {
      profile: 'AutomationEngineer',
      name: 'Automation Engineer',
      order: 6,
      actions: ['AutomationPlanning', 'AutomationExecution', 'CoverageQualityCheck', 'QAConclusion'],
      watch_actions: ['TestCaseReview'],
    },
  ],
};

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

    // Step 5: Create default workflow
    console.log('\n📦 Step 5: Creating default workflow...');
    await pool.query(
      `INSERT INTO application_workflows (id, application_id, name, description, is_default, workflow_config)
       VALUES ('00000000-0000-0000-0000-000000000003', $1, '默认工作流', '系统默认工作流配置', true, $2)
       ON CONFLICT DO NOTHING`,
      [appId, JSON.stringify(defaultWorkflowConfig)]
    );
    console.log('✅ Default workflow created');

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

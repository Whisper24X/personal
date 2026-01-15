/**
 * Generate command
 * Creates a new project from an idea
 */

import { Context } from '../../core/context/Context';
import { Team } from '../../orchestration/Team';
import { ProductManager } from '../../roles/ProductManager';
import { Architect } from '../../roles/Architect';
import { ProjectManager as ProjectManagerRole } from '../../roles/ProjectManager';
import { Engineer } from '../../roles/Engineer';
import { ProjectManager } from '../../orchestration/ProjectManager';
import { logger } from '../../utils';
import { parseCodeFiles } from '../../prompts/code';

export async function generateCommand(idea: string, options: any) {
  console.log('\n🚀 Mind2Build - AI Multi-Agent Project Generator\n');
  console.log(`💡 Idea: ${idea}\n`);
  
  try {
    // Create context
    const ctx = new Context(undefined, options.budget || 10.0);
    
    console.log(`💰 Budget: $${ctx.costManager.maxBudget}`);
    console.log(`🔄 Max Rounds: ${options.rounds || 5}`);
    console.log(`🎯 Mode: ${options.interactive ? 'Interactive (手动确认)' : 'Automatic (自动执行)'}\n`);
    
    // Create team with interactive mode
    const team = new Team(ctx, options.interactive);
    
    // Hire roles
    console.log('👥 Hiring team members...');
    team.hire([
      new ProductManager(ctx),
      new Architect(ctx),
      new ProjectManagerRole(ctx),
      new Engineer(ctx),
    ]);
    console.log('   ✅ ProductManager (Alice)');
    console.log('   ✅ Architect (Bob)');
    console.log('   ✅ ProjectManager (David)');
    console.log('   ✅ Engineer (Charlie)\n');
    
    if (options.interactive) {
      console.log('ℹ️  交互模式已启用:');
      console.log('   - 每个角色完成后会暂停等待您的确认');
      console.log('   - 您可以查看、编辑或重新生成输出');
      console.log('   - 使用 c=继续, e=编辑, r=重新生成, v=查看, s=跳过, q=退出\n');
    }
    
    // Run the team
    console.log('🔨 Starting project generation...\n');
    const result = await team.run(idea, options.rounds || 5);
    
    if (!result.success) {
      console.log('\n❌ Project generation failed');
      return;
    }
    
    console.log('\n✅ Project generation completed!\n');
    
    // Display cost
    const costReport = ctx.costManager.getReport();
    console.log('📊 Cost Report:');
    console.log(`   Prompt Tokens: ${costReport.totalPromptTokens}`);
    console.log(`   Completion Tokens: ${costReport.totalCompletionTokens}`);
    console.log(`   Total Cost: $${costReport.totalCost.toFixed(4)}\n`);
    
    // Save output if requested
    if (options.output) {
      console.log(`💾 Saving output to ${options.output}...\n`);
      
      const projectManager = new ProjectManager();
      const projectPath = await projectManager.createProject(options.output);
      
      // Save documents
      for (const msg of result.messages) {
        if (msg.causeBy === 'WritePRD') {
          await projectManager.writeFile(projectPath, 'PRD.md', msg.content);
          console.log('   ✅ Saved PRD.md');
        } else if (msg.causeBy === 'WriteDesign') {
          await projectManager.writeFile(projectPath, 'DESIGN.md', msg.content);
          console.log('   ✅ Saved DESIGN.md');
        } else if (msg.causeBy === 'BreakdownTasks') {
          await projectManager.writeFile(projectPath, 'TASK_BREAKDOWN.md', msg.content);
          console.log('   ✅ Saved TASK_BREAKDOWN.md');
        } else if (msg.causeBy === 'WriteSubProjectDesign') {
          await projectManager.writeFile(projectPath, 'SUB_PROJECT_DESIGN.md', msg.content);
          console.log('   ✅ Saved SUB_PROJECT_DESIGN.md');
        } else if (msg.causeBy === 'WriteCode') {
          const files = parseCodeFiles(msg.content);
          for (const file of files) {
            await projectManager.writeFile(projectPath, file.path, file.content);
            console.log(`   ✅ Saved ${file.path}`);
          }
        }
      }
      
      console.log(`\n✅ Project saved to ${projectPath}`);
    } else {
      // Display summary
      console.log('📄 Generated Documents:\n');
      for (const msg of result.messages) {
        if (msg.causeBy === 'WritePRD') {
          console.log('📋 PRD (Product Requirements Document)');
          console.log(`   ${msg.content.substring(0, 200)}...\n`);
        } else if (msg.causeBy === 'WriteDesign') {
          console.log('🏗️  System Design Document');
          console.log(`   ${msg.content.substring(0, 200)}...\n`);
        } else if (msg.causeBy === 'BreakdownTasks') {
          console.log('📝 Task Breakdown Document');
          console.log(`   ${msg.content.substring(0, 200)}...\n`);
        } else if (msg.causeBy === 'WriteSubProjectDesign') {
          console.log('🏛️  Sub-Project Design Document');
          console.log(`   ${msg.content.substring(0, 200)}...\n`);
        } else if (msg.causeBy === 'WriteCode') {
          const files = parseCodeFiles(msg.content);
          console.log(`💻 Generated Code (${files.length} files)`);
          files.forEach((f) => console.log(`   - ${f.path}`));
          console.log();
        }
      }
      
      console.log('💡 Tip: Use --output <directory> to save the generated files\n');
    }
    
  } catch (error: any) {
    logger.error('Generate command failed:', error);
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

export default generateCommand;


/**
 * Interactive Handler
 * Handles user interaction during project generation
 */

import * as readline from 'readline';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { logger } from './logger';

export enum UserAction {
  CONTINUE = 'continue',
  EDIT = 'edit',
  REGENERATE = 'regenerate',
  SKIP = 'skip',
  VIEW = 'view',
  QUIT = 'quit',
}

export interface InteractionResult {
  action: UserAction;
  modifiedContent?: string;
}

export class InteractiveHandler {
  private rl: readline.Interface;
  private isEnabled: boolean = false;

  constructor(enabled: boolean = false) {
    this.isEnabled = enabled;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Enable or disable interactive mode
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if interactive mode is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Close the readline interface
   */
  close(): void {
    this.rl.close();
  }

  /**
   * Wait for user confirmation after a role completes its task
   */
  async waitForConfirmation(
    roleName: string,
    actionName: string,
    content: string,
    outputFiles?: string[]
  ): Promise<InteractionResult> {
    if (!this.isEnabled) {
      return { action: UserAction.CONTINUE };
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n🎯 [${roleName}] 完成 ${actionName}\n`);
    
    if (outputFiles && outputFiles.length > 0) {
      console.log('📄 生成的文件:');
      outputFiles.forEach((file) => console.log(`   - ${file}`));
      console.log();
    }

    // Display a preview of the content
    const preview = this.getContentPreview(content);
    console.log('📋 内容预览:');
    console.log(preview);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    while (true) {
      const input = await this.prompt(
        '🛑 等待确认 (c=继续, e=编辑, r=重新生成, v=查看全文, s=跳过, q=退出): '
      );

      const action = this.parseAction(input.trim().toLowerCase());

      switch (action) {
        case UserAction.CONTINUE:
          console.log('✅ 继续下一步\n');
          return { action };

        case UserAction.EDIT:
          const modified = await this.editContent(content, actionName);
          if (modified) {
            console.log('✅ 已保存修改，继续下一步\n');
            return { action, modifiedContent: modified };
          }
          // If edit failed or was cancelled, ask again
          break;

        case UserAction.REGENERATE:
          console.log('🔄 请求重新生成...\n');
          return { action };

        case UserAction.SKIP:
          console.log('⏭️  跳过当前节点\n');
          return { action };

        case UserAction.VIEW:
          console.log('\n' + '='.repeat(80));
          console.log('完整内容:');
          console.log('='.repeat(80));
          console.log(content);
          console.log('='.repeat(80) + '\n');
          break;

        case UserAction.QUIT:
          console.log('🛑 退出流程\n');
          return { action };

        default:
          console.log('❌ 无效的选项，请重新输入\n');
      }
    }
  }

  /**
   * Parse user input to action
   */
  private parseAction(input: string): UserAction | null {
    const actionMap: Record<string, UserAction> = {
      c: UserAction.CONTINUE,
      continue: UserAction.CONTINUE,
      e: UserAction.EDIT,
      edit: UserAction.EDIT,
      r: UserAction.REGENERATE,
      regenerate: UserAction.REGENERATE,
      regen: UserAction.REGENERATE,
      s: UserAction.SKIP,
      skip: UserAction.SKIP,
      v: UserAction.VIEW,
      view: UserAction.VIEW,
      q: UserAction.QUIT,
      quit: UserAction.QUIT,
      exit: UserAction.QUIT,
    };

    return actionMap[input] || null;
  }

  /**
   * Get a preview of the content (first 500 characters)
   */
  private getContentPreview(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '\n... (查看全文请输入 v)';
  }

  /**
   * Open editor for user to modify content
   */
  private async editContent(
    content: string,
    actionName: string
  ): Promise<string | null> {
    try {
      // Create a temporary file
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `mind2build_${actionName}_${Date.now()}.md`);
      
      await fs.writeFile(tmpFile, content, 'utf-8');
      logger.info(`InteractiveHandler: Created temp file ${tmpFile}`);

      // Determine editor
      const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
      
      console.log(`\n📝 正在打开编辑器 (${editor})...`);
      console.log(`   文件路径: ${tmpFile}`);
      console.log('   保存并关闭编辑器以继续\n');

      // Open editor (synchronous)
      const { spawn } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        const editorProcess = spawn(editor, [tmpFile], {
          stdio: 'inherit',
        });

        editorProcess.on('exit', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Editor exited with code ${code}`));
          }
        });

        editorProcess.on('error', reject);
      });

      // Read modified content
      const modifiedContent = await fs.readFile(tmpFile, 'utf-8');
      
      // Clean up temp file
      await fs.unlink(tmpFile);
      logger.info(`InteractiveHandler: Cleaned up temp file ${tmpFile}`);

      if (modifiedContent !== content) {
        console.log('✅ 检测到内容修改');
        return modifiedContent;
      } else {
        console.log('ℹ️  内容未修改');
        return content;
      }
    } catch (error: any) {
      logger.error('InteractiveHandler: Failed to edit content', error);
      console.error(`❌ 编辑失败: ${error.message}`);
      return null;
    }
  }

  /**
   * Prompt user for input
   */
  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Display a confirmation message
   */
  async confirm(message: string): Promise<boolean> {
    const answer = await this.prompt(`${message} (y/n): `);
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  }

  /**
   * Display a summary of the session
   */
  displaySummary(history: Array<{ role: string; action: string; userAction: UserAction }>): void {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 交互式会话摘要\n');
    
    history.forEach((item, index) => {
      const actionIcon = this.getActionIcon(item.userAction);
      console.log(`${index + 1}. [${item.role}] ${item.action} → ${actionIcon} ${item.userAction}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Get icon for user action
   */
  private getActionIcon(action: UserAction): string {
    const icons: Record<UserAction, string> = {
      [UserAction.CONTINUE]: '✅',
      [UserAction.EDIT]: '✏️',
      [UserAction.REGENERATE]: '🔄',
      [UserAction.SKIP]: '⏭️',
      [UserAction.VIEW]: '👀',
      [UserAction.QUIT]: '🛑',
    };
    return icons[action] || '❓';
  }
}

export default InteractiveHandler;


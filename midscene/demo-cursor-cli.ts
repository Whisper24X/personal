/**
 * Cursor CLI 模式自动化 Demo
 * 使用 Cursor Agent CLI 执行自动化任务（非浏览器 UI）
 * 配置: .env 中的 CURSOR_API_KEY、CURSOR_CLI_MODEL 等
 *
 * 运行: npm run demo:cursor
 * 自定义任务: npm run demo:cursor -- "你的任务描述"
 * 前置: 需安装 Cursor IDE 或 Cursor CLI
 */
import { spawn } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
const CURSOR_CLI_MODEL = process.env.CURSOR_CLI_MODEL || 'composer-1.5';
const CURSOR_CLI_TIMEOUT = parseInt(process.env.CURSOR_CLI_TIMEOUT || '3600000', 10);

async function runCursorAgent(prompt: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const env = {
      ...process.env,
      CURSOR_API_KEY: CURSOR_API_KEY || process.env.CURSOR_API_KEY,
    };

    const args = [
      'agent',
      '--print',
      '--output-format', 'text',
      '--trust',
      prompt,
    ];

    if (CURSOR_CLI_MODEL) {
      args.splice(2, 0, '--model', CURSOR_CLI_MODEL);
    }

    console.log('🚀 启动 Cursor Agent...');
    console.log('📝 任务:', prompt);
    console.log('');

    const proc = spawn('cursor', args, {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Cursor Agent 超时 (${CURSOR_CLI_TIMEOUT}ms)`));
    }, CURSOR_CLI_TIMEOUT);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolvePromise(stdout);
      } else {
        reject(new Error(`Cursor Agent 退出码 ${code}\n${stderr}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      if (err.message?.includes('ENOENT')) {
        reject(new Error(
          '未找到 Cursor CLI。请安装 Cursor IDE 或执行: cursor auth login'
        ));
      } else {
        reject(err);
      }
    });
  });
}

async function main() {
  if (!CURSOR_API_KEY) {
    console.error('❌ 请设置 CURSOR_API_KEY 环境变量（在 .env 中配置）');
    process.exit(1);
  }

  if (CURSOR_API_KEY.startsWith('key_xxxxxxxx')) {
    console.error('❌ 请将 .env 中的 CURSOR_API_KEY 替换为你的真实 API Key');
    console.error('   获取方式: Cursor Dashboard → Integrations, 或 https://cursor.com/settings');
    process.exit(1);
  }

  // argv[0]=node, argv[1]=脚本路径, argv[2]及之后=用户传入的参数
  const customPrompt = process.argv.slice(2).join(' ').trim();
  const prompt = customPrompt || '列出当前目录下的文件，并创建一个 hello.txt 文件，内容为 Hello from Cursor CLI';

  try {
    await runCursorAgent(prompt);
    console.log('\n✅ Cursor CLI Demo 完成');
  } catch (err) {
    console.error('\n❌ 执行失败:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

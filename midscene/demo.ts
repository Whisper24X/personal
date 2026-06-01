/**
 * Midscene 视觉驱动 UI 自动化 Demo
 * 使用自然语言控制浏览器，在百度搜索并提取结果
 * 文档: https://midscenejs.com/
 */
import { chromium } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';
import 'dotenv/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('🚀 启动 Midscene 自动化 Demo...\n');

  const browser = await chromium.launch({
    headless: false, // 设为 true 可无头运行
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.goto('https://www.baidu.com');

  await sleep(3000); // 等待页面加载
  const agent = new PlaywrightAgent(page);

  // 1. 在搜索框输入关键词并搜索
  console.log('📝 在搜索框输入 "Midscene" 并搜索...');
  await agent.aiAct('在搜索框中输入 "Midscene"，然后点击搜索按钮或按回车');

  // 2. 等待搜索结果加载
  console.log('⏳ 等待搜索结果加载...');
  await agent.aiWaitFor('页面上出现至少一条搜索结果');

  // 3. 提取搜索结果
  console.log('📊 提取搜索结果...');
  const items = await agent.aiQuery<Array<{ title: string; link?: string }>>(
    '{title: string, link?: string}[], 获取搜索结果列表中每条结果的标题和链接'
  );
  console.log('\n搜索结果:', JSON.stringify(items, null, 2));

  // 4. AI 断言
  console.log('\n✅ 验证页面元素...');
  await agent.aiAssert('页面上有搜索相关的链接或结果');

  // 5. 获取第一条结果的标题
  const firstTitle = await agent.aiString('第一条搜索结果的标题是什么？');
  console.log('\n第一条结果标题:', firstTitle);

  console.log('\n✨ Demo 执行完成！');
  await sleep(2000);
  await browser.close();
}

main().catch((err) => {
  console.error('执行失败:', err);
  process.exit(1);
});

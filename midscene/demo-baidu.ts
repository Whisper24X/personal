/**
 * Midscene 简化版 Demo - 百度搜索
 * 适合快速验证 Midscene 是否正常工作
 */
import { chromium } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';
import 'dotenv/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 768 });
  await page.goto('https://www.baidu.com');
  await sleep(3000);

  const agent = new PlaywrightAgent(page);

  // 使用 aiAct 完成搜索
  await agent.aiAct('在搜索框输入"Playwright"并点击百度一下');

  await agent.aiWaitFor('出现搜索结果');
  const title = await agent.aiString('第一个搜索结果的标题');
  console.log('第一个结果:', title);

  await sleep(2000);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

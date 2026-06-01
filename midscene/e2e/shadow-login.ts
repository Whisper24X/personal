/**
 * 管理后台登录 + 进入渠道订单管理
 * 供 run-shadow-tests 复用
 */
import type { Page } from 'playwright';
import type { PlaywrightAgent } from '@midscene/web/playwright';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const DEFAULT_LOGIN_URL =
  process.env.SHADOW_LOGIN_URL || 'http://localhost:8080/shadow/login';
export const DEFAULT_ACCOUNT = process.env.SHADOW_ACCOUNT || '19371968034';
export const DEFAULT_PASSWORD = process.env.SHADOW_PASSWORD || '12345678Dyw';

/**
 * 打开登录页，输入账号密码并登录，等待进入后台（侧栏或订单管理出现）
 */
export async function login(
  page: Page,
  agent: PlaywrightAgent,
  options: {
    loginUrl?: string;
    account?: string;
    password?: string;
  } = {}
): Promise<void> {
  const loginUrl = options.loginUrl ?? DEFAULT_LOGIN_URL;
  const account = options.account ?? DEFAULT_ACCOUNT;
  const password = options.password ?? DEFAULT_PASSWORD;

  await page.goto(loginUrl);
  await sleep(2000);

  await agent.aiAct(`在账号输入框中输入 ${account}`);
  await agent.aiAct(`在密码输入框中输入 ${password}`);
  await agent.aiAct('点击登录按钮');
  await agent.aiWaitFor('出现侧栏或订单管理菜单', { timeoutMs: 15000 });
}

/**
 * 从当前后台页进入「渠道订单管理」页（侧栏点击订单管理 → 渠道订单管理 → 等待订单列表）
 */
export async function goToChannelOrderPage(
  agent: PlaywrightAgent
): Promise<void> {
  await agent.aiAct('在侧栏点击「订单管理」');
  await sleep(800);
  await agent.aiWaitFor('子菜单展开或出现渠道订单管理');
  await agent.aiAct('点击子菜单「渠道订单管理」');
  await agent.aiWaitFor('订单列表表格加载', { timeoutMs: 10000 });
}

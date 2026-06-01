/**
 * 管理后台正向场景自动化入口
 * 仅执行 TEST.md 中「正向场景」且「类型=管理后台」的 8 条用例
 *
 * 用法:
 *   npm run test:shadow
 *   npm run test:shadow -- --cases=TC-001,TC-007
 */
import 'dotenv/config';
import { chromium } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';
import { login, DEFAULT_LOGIN_URL, DEFAULT_ACCOUNT, DEFAULT_PASSWORD } from './shadow-login';
import { POSITIVE_CASE_IDS, runCase } from './cases/shadow-tests';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs(): { cases: string[] } {
  const args = process.argv.slice(2);
  let cases: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('--cases=')) {
      cases = arg.slice('--cases='.length).split(',').map((s) => s.trim()).filter(Boolean);
      break;
    }
  }
  return { cases };
}

async function main() {
  const { cases: requestedCases } = parseArgs();
  const caseIds = requestedCases.length > 0
    ? requestedCases.filter((id) => POSITIVE_CASE_IDS.includes(id as typeof POSITIVE_CASE_IDS[number]))
    : [...POSITIVE_CASE_IDS];

  if (caseIds.length === 0) {
    console.error('No valid case IDs. Allowed (positive only):', POSITIVE_CASE_IDS.join(', '));
    process.exit(1);
  }

  console.log('Login URL:', DEFAULT_LOGIN_URL);
  console.log('Account:', DEFAULT_ACCOUNT);
  console.log('Cases to run:', caseIds.join(', '));

  const browser = await chromium.launch({
    headless: process.env.HEADLESS === '1',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 768 });
  const agent = new PlaywrightAgent(page, {
    replanningCycleLimit: 30,
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];

  try {
    await login(page, agent);
    await sleep(1500);

    for (const caseId of caseIds) {
      console.log(`\n--- ${caseId} ---`);
      const result = await runCase(agent, page, caseId, { skipNavigate: false });
      results.push({ id: caseId, ok: result.ok, error: result.error });
      if (result.ok) {
        console.log(`${caseId} PASS`);
      } else {
        console.log(`${caseId} FAIL: ${result.error ?? 'unknown'}`);
      }
      await sleep(800);
    }
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log('\n--- Summary ---');
  console.log(`Passed: ${passed}/${results.length}`);
  if (failed.length > 0) {
    console.log('Failed:', failed.map((r) => `${r.id}: ${r.error ?? ''}`).join('; '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

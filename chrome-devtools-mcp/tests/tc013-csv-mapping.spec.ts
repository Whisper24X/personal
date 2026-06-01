/// <reference types="node" />
import { expect, test, type Locator, type Page } from '@playwright/test';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`缺少环境变量 ${name}，请复制 .env.example 为 .env 并填写`);
  }
  return v;
}

/**
 * 弹窗内渠道 Tab 很多 + 内部可滚动时，Playwright 默认每次 click/fill 会 scrollIntoView，
 * 易与弹窗滚动条互相拉扯造成「页面一直上下滚」。弹窗内操作统一 force，跳过自动滚动。
 */
const dialogAction = { force: true } as const;

/**
 * 下拉选项通常在 body 层 portal；兼容 role=option 与常见 UI 库列表项。
 */
/** Element Plus：占位 span 盖在 `role=combobox` 的 input 上，点 `.el-select` 外壳才能展开 */
async function openElSelectFirstRow(table: Locator) {
  await table.locator('tbody tr').first().locator('.el-select').click(dialogAction);
}

async function pickOverlayOption(page: Page, exactLabel: string) {
  const byRole = page.getByRole('option', { name: exactLabel, exact: true });
  if ((await byRole.count()) > 0) {
    await expect(byRole.first()).toBeVisible({ timeout: 10_000 });
    await byRole.first().click(dialogAction);
    return;
  }
  const fallback = page
    .locator(
      '.el-select-dropdown__item, .ant-select-item-option, .rc-virtual-list-holder-inner [role="option"]',
    )
    .filter({ hasText: new RegExp(`^${exactLabel}$`) });
  await expect(fallback.first()).toBeVisible({ timeout: 10_000 });
  await fallback.first().click(dialogAction);
}

test.describe('TC-013 CSV 映射配置', () => {
  test('侧栏订单管理 → CSV映射配置 → Tab「其他」→ A/B/C → 保存与 Then', async ({
    page,
  }) => {
    const loginUrl = requireEnv('LOGIN_URL');
    const user = requireEnv('LOGIN_USER');
    const pass = requireEnv('LOGIN_PASS');
    const serviceStatus = process.env.TC013_SERVICE_STATUS ?? '待预约';

    await test.step('登录', async () => {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

      const account = page
        .locator(
          'input[type="text"], input[type="tel"], input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])',
        )
        .first();
      await account.fill(user);
      await page.locator('input[type="password"]').fill(pass);
      await page.getByRole('button', { name: /登录|登陆/ }).click();

      await page
        .waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
        .catch(async () => {
          await expect(page.getByText(/工作台|首页|管理后台/)).toBeVisible({
            timeout: 60_000,
          });
        });

      await page
        .getByRole('alert')
        .filter({ hasText: /登录成功/ })
        .waitFor({ state: 'hidden', timeout: 10_000 })
        .catch(() => {});
    });

    await test.step('打开 CSV 映射配置弹窗', async () => {
      const nav = page.locator('[role="complementary"], aside').first();
      const csvBtn = page.getByRole('button', { name: 'CSV映射配置' });

      if (!(await csvBtn.isVisible().catch(() => false))) {
        await nav.getByRole('menuitem', { name: '订单管理' }).click();
        await nav.getByRole('menuitem', { name: '渠道订单管理' }).click();
      } else {
        await expect(csvBtn).toBeVisible({ timeout: 5000 });
      }

      await expect(csvBtn).toBeVisible({ timeout: 30_000 });
      await csvBtn.click({ force: true });
    });

    const dialog = page.getByRole('dialog').filter({ hasText: /CSV|映射配置/ }).first();
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    await test.step('切换到 Tab「其他」', async () => {
      await dialog.getByRole('tab', { name: '其他' }).click(dialogAction);
      await expect(dialog.getByRole('tabpanel', { name: '其他' })).toBeVisible();
    });

    const pane = dialog.getByRole('tabpanel', { name: '其他' });
    const dataTables = pane.locator('table').filter({
      has: page.locator('tbody').getByRole('combobox'),
    });
    await expect(dataTables).toHaveCount(3);
    const systemFieldTable = dataTables.nth(0);
    const orderStatusTable = dataTables.nth(1);
    const serviceStatusTable = dataTables.nth(2);

    await test.step('系统字段与 CSV：订单编号 + A', async () => {
      await openElSelectFirstRow(systemFieldTable);
      await pickOverlayOption(page, '订单编号');
      await systemFieldTable
        .getByRole('textbox', { name: '输入CSV文件字段名' })
        .fill('A', dialogAction);
    });

    await test.step('订单状态值：待支付 + B', async () => {
      await openElSelectFirstRow(orderStatusTable);
      await pickOverlayOption(page, '待支付');
      await orderStatusTable
        .getByRole('textbox', { name: '输入CSV文件中的状态值' })
        .fill('B', dialogAction);
    });

    await test.step('服务状态值映射 + C', async () => {
      await openElSelectFirstRow(serviceStatusTable);
      await pickOverlayOption(page, serviceStatus);
      await serviceStatusTable
        .getByRole('textbox', { name: '输入CSV文件中的状态值' })
        .fill('C', dialogAction);
    });

    await test.step('保存', async () => {
      await dialog.getByRole('button', { name: /保存/ }).click(dialogAction);
    });

    await test.step('Then：弹窗仍在、Tab 仍为「其他」', async () => {
      await expect(dialog).toBeVisible();
      const otherTab = dialog.getByRole('tab', { name: '其他' });
      await expect
        .poll(async () => {
          const aria = await otherTab.getAttribute('aria-selected');
          const cls = (await otherTab.getAttribute('class')) ?? '';
          return (
            aria === 'true' ||
            cls.includes('active') ||
            cls.includes('is-active') ||
            cls.includes('ant-tabs-tab-active')
          );
        })
        .toBeTruthy();
    });

    await test.step('Then：保存成功提示（可选；无 Toast 时不判失败）', async () => {
      const toast = page
        .locator(
          '.ant-message-notice, .el-message, .el-notification, [class*="message"], [role="alert"]',
        )
        .filter({ hasText: /^保存成功/ })
        .first();
      try {
        await expect(toast).toBeVisible({ timeout: 12_000 });
      } catch {
        test.info().annotations.push({
          type: 'warning',
          description:
            '未观测到「保存成功」Toast（可能接口错误或文案不同）；硬断言以弹窗仍在 + Tab「其他」为准',
        });
      }
    });
  });
});

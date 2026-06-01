/**
 * TEST.md 正向场景 + 管理后台 共 8 条用例的 When/Then 实现
 */
import type { Page } from 'playwright';
import type { PlaywrightAgent } from '@midscene/web/playwright';
import { goToChannelOrderPage } from '../shadow-login';
import path from 'path';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const POSITIVE_CASE_IDS = [
  'TC-001',
  'TC-002',
  'TC-004',
  'TC-005',
  'TC-007',
  'TC-008',
  'TC-009',
  'TC-010',
] as const;

export type PositiveCaseId = (typeof POSITIVE_CASE_IDS)[number];

export interface RunCaseOptions {
  csvPath?: string;
  skipNavigate?: boolean;
}

/**
 * 执行指定用例（Given 已登录且可访问渠道订单管理；本函数内会先进入渠道订单管理再执行 When/Then）
 */
export async function runCase(
  agent: PlaywrightAgent,
  page: Page,
  caseId: string,
  options: RunCaseOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const csvPath = options.csvPath ?? path.resolve(process.cwd(), 'fixtures/orders_other.csv');

  if (!POSITIVE_CASE_IDS.includes(caseId as PositiveCaseId)) {
    return { ok: false, error: `Unknown or non-positive case: ${caseId}` };
  }

  try {
    if (!options.skipNavigate) {
      await goToChannelOrderPage(agent);
      await sleep(500);
    }

    switch (caseId) {
      case 'TC-001':
        await agent.aiAct(
          '在渠道订单管理页点击「CSV映射配置」按钮，等待弹窗打开后点击「其他」Tab，等待映射表单加载，然后确认映射表单区域包含「系统字段与CSV文件字段映射」「订单状态值映射」「服务状态值映射」三个配置区块'
        );
        break;

      case 'TC-002': {
        await agent.aiAct(
          '在渠道订单管理页点击「CSV映射配置」按钮，等待弹窗打开后点击「其他」Tab，等待映射表单加载；添加字段映射：系统字段选「支付时间」、CSV 列填 channel_name；添加订单状态值映射：系统状态值选「支付时间」、CSV 列填 channel_name；添加服务状态值映射：系统状态值选「待预约」、CSV 列填 channel_name；点击「保存」按钮，等待保存成功提示'
        );
        await agent.aiAct(
          '再次点击「CSV映射配置」按钮，等待弹窗打开后点击「其他」Tab，确认映射配置弹窗内「其他」Tab 的系统字段映射表中存在对应配置或存在包含 channel_name 的配置行'
        );
        break;
      }

      case 'TC-004':
        await agent.aiAct(
          '在渠道订单管理页点击「CSV映射配置」按钮，点击「其他」Tab，在系统字段映射表某行点击「系统字段」列的下拉框，确认下拉选项列表中有「支付时间」'
        );
        break;

      case 'TC-005': {
        await agent.aiAct(
          '在渠道订单管理页点击「导入渠道订单」按钮，在导入弹窗中将「购买渠道」选为「其他」，准备好后不要点确定'
        );
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(csvPath).catch(() => {});
        await sleep(500);
        await agent.aiAct(
          '在导入弹窗中点击「确定」按钮，等待导入完成或出现导入成功提示，在成功对话框中点确定，在搜索区将购买渠道选为「其他」并点击搜索，确认订单列表中可见对应订单且购买渠道列显示为「其他」'
        );
        break;
      }

      case 'TC-007':
        await agent.aiAct('在搜索区域点击「购买渠道」下拉框，确认选项列表中有「其他」');
        break;

      case 'TC-008':
        await agent.aiAct(
          '在搜索区域将「购买渠道」选为「其他」，点击搜索，确认列表仅展示购买渠道为「其他」的订单且列表中该列显示为「其他」'
        );
        break;

      case 'TC-009':
        await agent.aiAct(
          '在渠道订单管理页点击「导入渠道订单」，等待导入弹窗打开后点击「购买渠道」下拉框，确认选项列表中有「其他」'
        );
        break;

      case 'TC-010': {
        await agent.aiAct(
          '在渠道订单管理页点击「导入渠道订单」按钮，在导入弹窗中将「购买渠道」选为「其他」，准备好后不要点确定'
        );
        const input = page.locator('input[type="file"]').first();
        await input.setInputFiles(csvPath).catch(() => {});
        await sleep(500);
        await agent.aiAct(
          '在导入弹窗中点击「确定」按钮，等待导入完成或出现导入成功提示，在成功对话框中点确定，在搜索区将购买渠道选为「其他」并点击搜索，确认订单列表中可见对应订单且购买渠道列显示为「其他」'
        );
        break;
      }

      default:
        return { ok: false, error: `No implementation for ${caseId}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

# TC-channel-015：端到端 - 新增渠道并完成首次导入全流程
import os

from playwright.sync_api import Page

from tests.page.channel_orders import (
    open_channel_config_dialog,
    open_import_dialog,
    select_import_channel,
    upload_csv_and_import,
)


def test_tc_channel_015_e2e_add_channel_and_first_import(
    channel_orders_page: Page, fixtures_dir: str
) -> None:
    """TC-channel-015：端到端 - 新增渠道并完成首次导入全流程。

    Given: 用户已进入渠道订单管理页，准备新渠道名称与编码及有效 CSV
    When: 渠道配置新增「全流程测试渠道」/ e2e_test → 关闭弹窗 → 导入渠道订单 → 选择该渠道 → 上传 CSV → 导入
    Then: 新增成功，导入弹窗可选中该渠道，导入完成出现成功提示
    """
    page = channel_orders_page
    # Step 1: 打开渠道配置并新增渠道
    open_channel_config_dialog(page)
    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="新增渠道")
    name_input = dialog.locator('input[placeholder*="渠道名称"]').first
    code_input = dialog.locator('input[placeholder*="渠道编码"], input[placeholder*="编码"]').first
    name_input.wait_for(state="visible", timeout=5000)
    name_input.fill("全流程测试渠道")
    code_input.wait_for(state="visible", timeout=5000)
    code_input.fill("e2e_test")
    page.get_by_role("button", name="新增").click()
    page.locator(".el-message--success").or_(page.locator("text=新增成功")).or_(
        page.locator("text=成功")
    ).first.wait_for(state="visible", timeout=10000)
    # 关闭渠道配置弹窗（Esc 或关闭按钮）
    page.keyboard.press("Escape")
    page.locator(".el-dialog, .el-drawer").first.wait_for(state="hidden", timeout=5000)

    # Step 2: 打开导入弹窗，选择「全流程测试渠道」，上传 CSV 并导入
    open_import_dialog(page)
    select_import_channel(page, "全流程测试渠道")
    csv_path = os.path.join(fixtures_dir, "valid_orders.csv")
    assert os.path.isfile(csv_path), f"测试数据不存在: {csv_path}"
    upload_csv_and_import(page, csv_path)

    # Then: 导入完成出现成功提示
    page.locator(".el-message--success").or_(page.locator("text=导入成功")).or_(
        page.locator("text=成功")
    ).first.wait_for(state="visible", timeout=20000)
    assert (
        page.locator(".el-message--success").is_visible()
        or page.locator("text=导入成功").is_visible()
        or "成功" in (page.locator(".el-message").first.text_content() or "")
    )

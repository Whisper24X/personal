# TC-channel-007, 009：CSV 导入与渠道联动
import os

from playwright.sync_api import Page

from tests.page.channel_orders import open_import_dialog, select_import_channel, upload_csv_and_import


def test_tc_channel_007_import_channel_dropdown_shows_configured(channel_orders_page: Page) -> None:
    """TC-channel-007：CSV 导入渠道联动 - 购买渠道下拉框展示已配置渠道。

    Given: 用户已进入渠道订单管理页，系统中已配置渠道
    When: 点击「导入渠道订单」→ 等待弹窗打开 → 点击「购买渠道」下拉框
    Then: 购买渠道下拉框展示所有已配置渠道（至少有一个选项）
    """
    page = channel_orders_page
    open_import_dialog(page)
    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="购买渠道").first
    channel_select = dialog.locator(".el-form-item").filter(has_text="购买渠道").locator(".el-select").first
    channel_select.wait_for(state="visible", timeout=5000)
    channel_select.click()
    page.get_by_role("listbox").or_(page.locator(".el-select-dropdown")).first.wait_for(
        state="visible", timeout=5000
    )
    options = page.get_by_role("option").all()
    assert len(options) >= 1, "购买渠道下拉应至少有一个已配置渠道选项"


def test_tc_channel_009_import_csv_success(
    channel_orders_page: Page, fixtures_dir: str
) -> None:
    """TC-channel-009：CSV 导入渠道联动 - 选择新渠道上传 CSV 成功导入。

    Given: 用户已打开导入渠道订单弹窗，购买渠道中存在可选渠道，已准备有效 CSV
    When: 选择渠道 → 上传 CSV → 点击导入/提交 → 等待导入完成
    Then: 出现导入成功提示，弹窗关闭或显示完成状态
    """
    page = channel_orders_page
    open_import_dialog(page)
    csv_path = os.path.join(fixtures_dir, "valid_orders.csv")
    assert os.path.isfile(csv_path), f"测试数据不存在: {csv_path}"

    # 选择第一个可用渠道（或「其他」等）；若页面有「其他」则选「其他」
    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="购买渠道").first
    channel_select = dialog.locator(".el-form-item").filter(has_text="购买渠道").locator(".el-select").first
    channel_select.click()
    first_option = page.get_by_role("option").first
    first_option.wait_for(state="visible", timeout=5000)
    first_option.click()

    upload_csv_and_import(page, csv_path)
    page.locator(".el-message--success").or_(page.locator("text=导入成功")).or_(
        page.locator("text=成功")
    ).first.wait_for(state="visible", timeout=15000)
    assert (
        page.locator(".el-message--success").is_visible()
        or page.locator("text=导入成功").is_visible()
        or page.locator("text=成功").first.is_visible()
    )

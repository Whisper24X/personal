# TC-channel-011, 013：CSV 映射配置 - Tab 展示与字段映射保存
# 依据 csv文件映射配置.md + webapp-testing 技能：getByRole、基于元素等待、无固定等待、区块定位、同行断言
from playwright.sync_api import Page

from tests.page.channel_orders import open_csv_mapping_dialog, switch_to_tab_in_mapping_dialog


def test_tc_channel_011_mapping_tabs_show_configured_channels(channel_orders_page: Page) -> None:
    """TC-channel-011：CSV 映射配置渠道联动 - Tab 按已配置渠道展示。

    Given: 用户已进入渠道订单管理页，系统中已配置渠道
    When: 点击「CSV 映射配置」按钮，等待映射配置弹窗打开
    Then: 映射配置弹窗中 Tab 按已配置渠道展示（至少有一个 Tab，如「其他」）
    """
    page = channel_orders_page
    open_csv_mapping_dialog(page)
    dialog = page.get_by_role("dialog", name="CSV文件映射配置")
    assert dialog.is_visible()
    tabs = page.locator(".el-tabs__item")
    tabs.first.wait_for(state="visible", timeout=5000)
    assert tabs.count() >= 1
    # 常见默认渠道 Tab 或「其他」
    has_other = page.locator(".el-tabs__item").filter(has_text="其他").count() > 0
    assert has_other or tabs.count() >= 1


def _click_select_and_choose(page: Page, section, option_text: str, retry: bool = True) -> None:
    """点击区块内的下拉组件（非 input）并选择选项；若未展开则重试一次。"""
    el_select = section.locator(".el-select").first
    el_select.wait_for(state="visible", timeout=5000)
    el_select.click()
    opt = page.get_by_role("option", name=option_text)
    if not opt.is_visible() and retry:
        el_select.click()
    opt.wait_for(state="visible", timeout=3000)
    opt.click()


def test_tc_channel_013_csv_mapping_config_save(channel_orders_page: Page) -> None:
    """TC-channel-013（优化版）：CSV映射配置 - 新渠道Tab字段映射并保存。

    验证在「其他」渠道Tab下，完成三类映射配置后可以成功保存，且数据正确展示。
    """
    page = channel_orders_page
    open_csv_mapping_dialog(page)
    switch_to_tab_in_mapping_dialog(page, "其他")

    pane = page.locator('.el-tab-pane[aria-hidden="false"]').first
    pane.wait_for(state="visible", timeout=5000)

    # Step 4：系统字段与CSV字段映射（有行则复用，无行则添加）
    add_field_btn = pane.get_by_role("button", name="添加字段映射")
    if add_field_btn.is_visible():
        has_row = pane.locator(".el-table .el-select").count() > 0
        if not has_row:
            add_field_btn.click()
            pane.locator(".el-table .el-select").first.wait_for(state="visible", timeout=5000)
    sys_select = pane.locator(".el-table .el-select").first
    sys_select.wait_for(state="visible", timeout=5000)
    sys_select.click()
    page.get_by_role("option", name="订单编号").wait_for(state="visible", timeout=3000)
    page.get_by_role("option", name="订单编号").click()
    csv_input = pane.get_by_placeholder("输入CSV文件字段名").or_(
        pane.locator('input[placeholder*="输入CSV文件字段名"]')
    ).first
    csv_input.wait_for(state="visible", timeout=3000)
    csv_input.clear()
    csv_input.fill("A")

    # Step 5：订单状态值映射（区块定位 + 点下拉组件 + 可选重试）
    order_section = pane.locator("div").filter(has_text="订单状态值映射").first
    order_add_btn = order_section.get_by_role("button", name="添加状态映射")
    if order_add_btn.is_visible():
        if order_section.locator(".el-select").count() == 0:
            order_add_btn.click()
            order_section.locator(".el-select").first.wait_for(state="visible", timeout=3000)
    _click_select_and_choose(page, order_section, "待支付")
    order_section.locator('input[placeholder*="输入CSV文件中的状态"]').first.wait_for(state="visible", timeout=3000)
    order_section.locator('input[placeholder*="输入CSV文件中的状态"]').first.clear()
    order_section.locator('input[placeholder*="输入CSV文件中的状态"]').first.fill("B")

    # Step 6：服务状态值映射
    service_section = pane.locator("div").filter(has_text="服务状态值映射").first
    service_add_btn = service_section.get_by_role("button", name="添加状态映射")
    if service_add_btn.is_visible():
        if service_section.locator(".el-select").count() == 0:
            service_add_btn.click()
            service_section.locator(".el-select").first.wait_for(state="visible", timeout=3000)
    _click_select_and_choose(page, service_section, "待预约")
    service_section.locator('input[placeholder*="输入CSV文件中的状态"]').first.wait_for(state="visible", timeout=3000)
    service_section.locator('input[placeholder*="输入CSV文件中的状态"]').first.clear()
    service_section.locator('input[placeholder*="输入CSV文件中的状态"]').first.fill("C")

    # Step 7：保存
    page.get_by_role("button", name="保存").click()
    page.locator(".el-message--success").wait_for(state="visible", timeout=5000)

    # 基础断言
    assert page.locator(".el-message--success").is_visible()
    assert page.get_by_role("dialog", name="CSV文件映射配置").is_visible()
    assert pane.is_visible()

    # 数据断言（区块内/同行关联：字段映射、订单状态、服务状态）
    field_block = pane.locator("div").filter(has_text="系统字段与CSV字段映射").first
    field_row = field_block.locator(".el-table tbody tr").first
    field_row.wait_for(state="visible", timeout=3000)
    assert field_row.locator("text=订单编号").count() > 0
    assert field_row.locator("text=A").count() > 0

    assert order_section.locator("text=待支付").first.is_visible()
    assert order_section.locator("text=B").first.is_visible()
    assert service_section.locator("text=待预约").first.is_visible()
    assert service_section.locator("text=C").first.is_visible()

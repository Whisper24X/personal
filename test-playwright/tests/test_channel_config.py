# TC-channel-001, 004, 005：渠道配置入口与新增
from playwright.sync_api import Page

from tests.page.channel_orders import go_to_channel_orders, open_channel_config_dialog


def test_tc_channel_001_open_config_dialog(channel_orders_page: Page) -> None:
    """TC-channel-001：渠道配置入口 - 点击按钮打开渠道配置弹窗。

    Given: 用户已进入渠道订单管理页
    When: 在 extra-buttons 区域点击「渠道配置」按钮，等待弹窗加载完成
    Then: 打开渠道配置弹窗或抽屉，内展示渠道列表区域或「新增」按钮
    """
    page = channel_orders_page
    open_channel_config_dialog(page)
    # Then: 弹窗/抽屉内展示渠道列表区域或「新增」按钮
    assert page.get_by_role("button", name="新增").is_visible()
    assert page.locator(".el-dialog, .el-drawer").locator(".el-table, .el-form").first.is_visible()


def test_tc_channel_004_channel_add_success(channel_orders_page: Page) -> None:
    """TC-channel-004：渠道配置新增 - 新增渠道成功。

    Given: 用户已打开渠道配置弹窗或抽屉
    When: 填写名称「A」、编码「a」→ 点击「新增」
    Then: 出现「新增成功」提示，列表中存在该渠道行
    """
    page = channel_orders_page
    open_channel_config_dialog(page)

    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="新增渠道")
    name_input = dialog.locator('input[placeholder*="渠道名称"]').first
    code_input = dialog.locator('input[placeholder*="渠道编码"], input[placeholder*="编码"]').first

    name_input.wait_for(state="visible", timeout=5000)
    name_input.fill("A")
    code_input.wait_for(state="visible", timeout=5000)
    code_input.fill("a")

    page.get_by_role("button", name="新增").click()
    page.locator(".el-message--success").or_(page.locator("text=新增成功")).first.wait_for(
        state="visible", timeout=10000
    )
    success_msg = page.locator(".el-message--success").or_(page.locator("text=新增成功"))
    assert success_msg.is_visible()

    table = page.locator(".el-table")
    assert table.locator("text=A").first.is_visible()
    assert table.locator("text=a").first.is_visible()


def test_tc_channel_005_duplicate_code_shows_error(channel_orders_page: Page) -> None:
    """TC-channel-005：渠道配置新增 - 编码重复时提示错误。

    Given: 用户已打开渠道配置弹窗，系统中已存在编码「wechat」的渠道
    When: 点击「新增」→ 填写名称「新微信渠道」、编码「wechat」→ 提交
    Then: 出现「该编码已存在」或类似错误提示，表单未提交
    """
    page = channel_orders_page
    open_channel_config_dialog(page)

    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="新增渠道")
    name_input = dialog.locator('input[placeholder*="渠道名称"]').first
    code_input = dialog.locator('input[placeholder*="渠道编码"], input[placeholder*="编码"]').first

    name_input.wait_for(state="visible", timeout=5000)
    name_input.fill("新微信渠道")
    code_input.wait_for(state="visible", timeout=5000)
    code_input.fill("wechat")

    page.get_by_role("button", name="新增").click()
    # Then: 出现编码已存在类错误提示（message 或 form 内文案）
    page.locator("text=编码").or_(page.locator("text=已存在")).or_(page.locator(".el-message--error")).first.wait_for(
        state="visible", timeout=8000
    )
    has_error = (
        page.locator("text=已存在").is_visible()
        or page.locator("text=编码").filter(has_text="存在").is_visible()
        or page.locator(".el-message--error").is_visible()
    )
    assert has_error

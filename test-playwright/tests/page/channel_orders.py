"""渠道订单管理页：侧栏导航、列表、CSV 映射弹窗、导入弹窗。"""
from playwright.sync_api import Page


def go_to_channel_orders(page: Page) -> None:
    """侧栏点击「订单管理」→ 子菜单「渠道订单管理」→ 等待表格或空态出现（无固定等待）。"""
    channel_item = page.locator("text=渠道订单管理").first
    if not channel_item.is_visible():
        page.locator("text=订单管理").first.click()
        channel_item.wait_for(state="visible", timeout=3000)
    channel_item.click()
    # 等待条件：订单表格可见 或 空态「暂无数据」出现
    page.locator(".el-table").or_(page.get_by_text("暂无数据", exact=False)).first.wait_for(state="visible", timeout=10000)


def open_channel_config_dialog(page: Page) -> None:
    """在渠道订单管理页 extra-buttons 区域点击「渠道配置」并等待弹窗/抽屉加载完成。"""
    btn = page.get_by_role("button", name="渠道配置")
    btn.click()
    # 等待弹窗/抽屉打开：先等「新增」按钮
    page.get_by_role("button", name="新增").wait_for(state="visible", timeout=5000)
    # 弹窗完全加载：等待表单输入框可见（名称、编码通常在弹窗内）
    page.locator(".el-dialog, .el-drawer").locator("input").first.wait_for(state="visible", timeout=5000)


def open_csv_mapping_dialog(page: Page) -> None:
    """点击「CSV映射配置」并等待弹窗打开。"""
    page.get_by_role("button", name="CSV映射配置").click()
    page.get_by_role("dialog", name="CSV文件映射配置").wait_for(state="visible", timeout=5000)


def switch_to_tab_in_mapping_dialog(page: Page, tab_name: str) -> None:
    """在映射配置弹窗中点击指定 Tab（如「其他」），以区块标题出现为加载完成。"""
    tab = page.get_by_role("tab", name=tab_name).or_(page.locator(".el-tabs__item").filter(has_text=tab_name))
    tab.first.click()
    pane = page.locator('.el-tab-pane[aria-hidden="false"]').first
    pane.wait_for(state="visible", timeout=5000)
    # 以区块标题出现作为 Tab 加载完成（自动化约束）
    pane.get_by_text("系统字段与CSV字段映射", exact=False).or_(
        pane.get_by_text("订单状态值映射", exact=False)
    ).or_(pane.get_by_text("服务状态值映射", exact=False)).first.wait_for(state="visible", timeout=5000)


def fill_search_phone(page: Page, phone: str) -> None:
    """在搜索区填写手机号。"""
    inp = page.get_by_label("手机号").or_(page.locator('input[placeholder*="手机号"]')).first
    inp.fill(phone)


def fill_search_product_name(page: Page, name: str) -> None:
    """在搜索区填写商品名称。"""
    inp = page.get_by_label("商品名称").or_(page.locator('input[placeholder*="商品名称"]')).first
    inp.fill(name)


def select_search_channel(page: Page, channel: str) -> None:
    """在搜索区选择购买渠道。"""
    sel = page.locator(".el-form-item").filter(has_text="购买渠道").locator(".el-select").first
    sel.click()
    page.get_by_role("option", name=channel).click()


def fill_search_payment_time(page: Page, start: str, end: str) -> None:
    """在搜索区填写支付时间范围。"""
    section = page.locator(".el-form-item, div").filter(has_text="支付时间").first
    inputs = section.locator("input").all()
    if len(inputs) >= 2:
        inputs[0].fill(start)
        inputs[1].fill(end)
    else:
        section.locator("input").first.fill(f"{start} - {end}")


def click_search(page: Page) -> None:
    """点击搜索按钮并等待列表刷新。"""
    page.get_by_role("button", name="搜索").click()
    page.wait_for_load_state("networkidle")


def click_reset(page: Page) -> None:
    """点击重置按钮。"""
    page.get_by_role("button", name="重置").click()


# ---------- 导入渠道订单弹窗 ----------


def open_import_dialog(page: Page) -> None:
    """点击「导入渠道订单」并等待导入弹窗打开。"""
    page.get_by_role("button", name="导入渠道订单").click()
    page.locator(".el-dialog, .el-drawer").filter(has_text="导入").or_(page.get_by_text("购买渠道")).first.wait_for(
        state="visible", timeout=8000
    )


def select_import_channel(page: Page, channel_name: str) -> None:
    """在导入弹窗中选择购买渠道。"""
    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="购买渠道").first
    sel = dialog.locator(".el-form-item").filter(has_text="购买渠道").locator(".el-select").first
    sel.click()
    page.get_by_role("option", name=channel_name).wait_for(state="visible", timeout=3000)
    page.get_by_role("option", name=channel_name).click()


def upload_csv_and_import(page: Page, csv_path: str) -> None:
    """在导入弹窗中上传 CSV 并点击导入/提交。"""
    dialog = page.locator(".el-dialog, .el-drawer").filter(has_text="购买渠道").first
    file_input = dialog.locator('input[type="file"]').first
    file_input.wait_for(state="attached", timeout=3000)
    file_input.set_input_files(csv_path)
    page.get_by_role("button", name="导入").or_(page.get_by_role("button", name="提交")).or_(
        page.locator("button").filter(has_text="导入")
    ).first.click()

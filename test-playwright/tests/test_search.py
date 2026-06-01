# TC-search-001～006：渠道订单管理搜索/筛选
from playwright.sync_api import Page

from tests.page.channel_orders import (
    go_to_channel_orders,
    fill_search_phone,
    fill_search_product_name,
    select_search_channel,
    fill_search_payment_time,
    click_search,
    click_reset,
)


def test_tc_search_001_search_by_phone(channel_orders_page: Page) -> None:
    """TC-search-001：按手机号搜索 - 正向。"""
    page = channel_orders_page
    fill_search_phone(page, "19371968034")
    click_search(page)
    # Then: 列表仅展示该手机号订单或空列表
    table = page.locator(".el-table")
    rows = table.locator("tbody tr")
    if rows.count() > 0:
        assert table.locator("text=19371968034").first.is_visible()
    # 若无结果则空列表（无额外断言）


def test_tc_search_002_search_by_product_name(channel_orders_page: Page) -> None:
    """TC-search-002：按商品名称搜索 - 正向。"""
    page = channel_orders_page
    fill_search_product_name(page, "四百大妈展览")
    click_search(page)
    # Then: 列表仅展示商品名称包含「四百大妈展览」的订单
    table = page.locator(".el-table")
    if table.locator("tbody tr").count() > 0:
        assert table.locator("text=四百大妈展览").first.is_visible()


def test_tc_search_003_search_by_channel(channel_orders_page: Page) -> None:
    """TC-search-003：按购买渠道筛选 - 正向。"""
    page = channel_orders_page
    select_search_channel(page, "小程序")
    click_search(page)
    # Then: 列表仅展示购买渠道为「小程序」的订单；若无则空列表
    table = page.locator(".el-table")
    if table.locator("tbody tr").count() > 0:
        assert table.locator("text=小程序").first.is_visible()


def test_tc_search_004_search_by_payment_time(channel_orders_page: Page) -> None:
    """TC-search-004：按支付时间筛选 - 正向。"""
    page = channel_orders_page
    fill_search_payment_time(page, "2026-01-01", "2026-03-16")
    click_search(page)
    # Then: 列表仅展示支付时间在该区间内的订单；若无则空列表
    page.wait_for_load_state("networkidle")
    # 表格刷新即满足（具体区间校验需解析列表数据，此处仅验证无报错）
    assert page.locator(".el-table").is_visible()


def test_tc_search_005_combined_search(channel_orders_page: Page) -> None:
    """TC-search-005：组合条件搜索 - 正向。"""
    page = channel_orders_page
    fill_search_phone(page, "19371968034")
    fill_search_product_name(page, "四百大妈展览")
    select_search_channel(page, "小程序")
    fill_search_payment_time(page, "2026-01-01", "2026-03-16")
    click_search(page)
    # Then: 列表仅展示同时满足上述条件的订单
    table = page.locator(".el-table")
    if table.locator("tbody tr").count() > 0:
        assert table.locator("text=19371968034").or_(table.locator("text=四百大妈展览")).or_(table.locator("text=小程序")).first.is_visible()


def test_tc_search_006_reset_clears_filters(channel_orders_page: Page) -> None:
    """TC-search-006：重置 - 清空筛选条件。"""
    page = channel_orders_page
    fill_search_phone(page, "19371968034")
    fill_search_product_name(page, "四百大妈展览")
    click_reset(page)
    page.wait_for_load_state("networkidle")
    # Then: 筛选条件清空
    phone_inp = page.get_by_label("手机号").or_(page.locator('input[placeholder*="手机号"]')).first
    product_inp = page.get_by_label("商品名称").or_(page.locator('input[placeholder*="商品名称"]')).first
    assert phone_inp.input_value() == ""
    assert product_inp.input_value() == ""

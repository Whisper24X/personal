"""
公共 fixture：浏览器、页面、已登录页面、BASE_URL、fixtures 目录。
环境变量：E2E_BASE_URL, E2E_USER, E2E_PASSWORD（见 README）。
视口：E2E_VIEWPORT_WIDTH（默认 1920）、E2E_VIEWPORT_HEIGHT（默认 1080）。
"""
import os
import pytest
from playwright.sync_api import sync_playwright, Browser, Page

from tests.page.login import get_base_url, login
from tests.page.channel_orders import go_to_channel_orders


def _viewport_size() -> dict:
    """全局视口宽高，所有用例共用同一 context 时在此生效。"""
    w = int(os.environ.get("E2E_VIEWPORT_WIDTH", "1920"))
    h = int(os.environ.get("E2E_VIEWPORT_HEIGHT", "1080"))
    return {"width": w, "height": h}


@pytest.fixture(scope="session")
def base_url() -> str:
    return get_base_url().rstrip("/")


@pytest.fixture(scope="session")
def fixtures_dir() -> str:
    return os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        vp = _viewport_size()
        # headless=False 时窗口尺寸与视口对齐，避免有头模式窗口过小
        window_arg = f"--window-size={vp['width']},{vp['height']}"
        browser = p.chromium.launch(headless=False, args=[window_arg])
        yield browser
        browser.close()


@pytest.fixture
def context(browser: Browser, base_url: str):
    ctx = browser.new_context(base_url=base_url, viewport=_viewport_size())
    yield ctx
    ctx.close()


@pytest.fixture
def page(context, base_url: str) -> Page:
    page = context.new_page()
    page.goto(base_url)
    page.wait_for_load_state("networkidle")
    yield page
    page.close()


@pytest.fixture
def logged_in_page(page: Page) -> Page:
    """已登录的页面，供依赖「已登录管理后台」的用例使用。"""
    login(page)
    return page


@pytest.fixture
def channel_orders_page(logged_in_page: Page) -> Page:
    """已登录且已进入渠道订单管理页（复用同一 session，适合顺序执行）。"""
    go_to_channel_orders(logged_in_page)
    return logged_in_page


@pytest.fixture
def channel_orders_page_fresh(context, base_url: str) -> Page:
    """已登录且已进入渠道订单管理页（每个 test 独立 session，避免 token 冲突）。

    用于需要账号隔离的场景（如 demo_04）。
    注意：默认复用同一登录态（channel_orders_page），需要隔离时使用此 fixture。
    """
    from tests.page.login import login
    page = context.new_page()
    page.goto(base_url)
    page.wait_for_load_state("networkidle")
    login(page)
    go_to_channel_orders(page)
    yield page
    page.close()

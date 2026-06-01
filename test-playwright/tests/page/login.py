"""登录页/登录动作。BASE_URL 固定为测试环境；账号密码从 E2E_USER, E2E_PASSWORD 读取。"""
import os
from playwright.sync_api import Page


# 测试地址（固定使用以下地址）
BASE_URL = "https://trip-shadow-test.yangcong345.com/trip/login"


def get_base_url() -> str:
    return BASE_URL.rstrip("/")


def get_credentials() -> tuple[str, str]:
    user = os.environ.get("E2E_USER", "19371968034")
    password = os.environ.get("E2E_PASSWORD", "12345678Dyw")
    return user, password


def login(page: Page) -> None:
    """打开 BASE_URL，输入账号密码并登录，等待进入后台（如侧栏出现）。"""
    base_url = get_base_url().rstrip("/")
    page.goto(base_url)
    page.wait_for_load_state("networkidle")

    user, password = get_credentials()

    # Element UI 常见：账号/手机号、密码输入框，登录按钮
    # 若页面结构不同可改为 placeholder / label / data-testid 等
    username_input = page.locator('input[type="text"], input[placeholder*="手机"], input[placeholder*="账号"]').first
    password_input = page.locator('input[type="password"]').first
    if username_input.count() == 0:
        username_input = page.locator(".el-input__inner").first
    if username_input.count():
        username_input.fill(user)
    if password_input.count():
        password_input.fill(password)

    login_btn = page.get_by_role("button", name="登 录").or_(page.locator('button:has-text("登录")')).first
    if login_btn.count() == 0:
        login_btn = page.locator('button[type="submit"]').first
    if login_btn.count():
        login_btn.click()

    page.wait_for_load_state("networkidle")
    # 等待侧栏或订单管理出现，表示已进入后台
    page.wait_for_selector('text=订单管理', timeout=15000)

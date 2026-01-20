from playwright.sync_api import sync_playwright, expect
import re

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.set_default_timeout(30000)
        
        try:
            # 步骤 1: 打开登录页面
            page.goto("https://trip-shadow-test.yangcong345.com/trip/login")
            print("步骤 1: 打开登录页面成功")
            
            # 等待页面加载完成
            page.wait_for_load_state("networkidle")
            
            # 点击账号输入框
            account_input = page.get_by_placeholder("请输入账号")
            account_input.click()
            print("步骤 1: 点击账号输入框成功")
            
            # 输入合法账号
            account_input.fill("19371968034")
            print("步骤 1: 输入合法账号成功")
            
            # 点击登录
            login_button = page.get_by_role("button", name="登录")
            login_button.click()
            print("步骤 1: 点击登录成功")
            
            # 验证页面链接不发生改变
            expect(page).to_have_url(re.compile(r"/login"))
            print("步骤 1: 验证页面链接不发生改变成功")
            
            print("测试执行成功")
        except Exception as e:
            print(f"测试执行失败: {e}")
            raise
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run()
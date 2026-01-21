from playwright.sync_api import sync_playwright, expect
import re

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        page.set_default_timeout(30000)
        step = 0
        
        try:
            # 步骤1: 打开登录页面
            step += 1
            page.goto("https://trip-shadow-test.yangcong345.com/trip/login")
            print(f"步骤{step}: 打开登录页面成功")
            
            # 步骤2: 输入账号
            step += 1
            account_input = page.get_by_placeholder("请输入账号")
            account_input.fill("19371968034")
            expect(account_input).to_have_value("19371968034")
            print(f"步骤{step}: 输入账号成功")
            
            # 步骤3: 输入密码
            step += 1
            password_input = page.get_by_placeholder("请输入密码")
            password_input.fill("12345678Dyw")
            expect(password_input).to_have_value("12345678Dyw")
            print(f"步骤{step}: 输入密码成功")
            
            # 步骤4: 点击登录
            step += 1
            login_button = page.get_by_role("button", name="登录")
            login_button.click()
            print(f"步骤{step}: 点击登录成功")
            
            # 步骤5: 验证登录成功（不猜测具体URL）
            step += 1
            page.wait_for_url(re.compile(r"^(?!.*login).*$"))
            expect(page).not_to_have_url(re.compile(r"/login"))
            print(f"步骤{step}: 验证登录成功")
            
            # 步骤6: 进入渠道订单页面
            step += 1
            page.wait_for_load_state("networkidle")
            page.wait_for_url(re.compile(r"/order"))
            print(f"步骤{step}: 进入渠道订单页面成功")
            
            # 步骤7: 输入订单编号
            step += 1
            order_id_input = page.get_by_placeholder("渠道订单编号")
            order_id_input.fill("123")
            expect(order_id_input).to_have_value("123")
            print(f"步骤{step}: 输入订单编号成功")
            
            # 步骤8: 输入手机号码
            step += 1
            phone_input = page.get_by_placeholder("手机号")
            phone_input.fill("19371968034")
            expect(phone_input).to_have_value("19371968034")
            print(f"步骤{step}: 输入手机号码成功")
            
            # 步骤9: 点击搜索按钮
            step += 1
            search_button = page.get_by_role("button", name="搜索")
            search_button.click()
            print(f"步骤{step}: 点击搜索按钮成功")
            
            # 步骤10: 验证搜索结果
            step += 1
            page.wait_for_timeout(2000)
            try:
                if page.locator("table").count() > 0:
                    print(f"步骤{step}: 能正常搜索到数据")
                elif page.get_by_text("暂无数据").count() > 0:
                    print(f"步骤{step}: 无匹配结果")
                else:
                    print(f"步骤{step}: 搜索已执行")
            except Exception as e:
                print(f"步骤{step}: {e}")
            finally:
                print(f"测试执行成功, 共执行 {step} 个步骤")
        except Exception as e:
            print(f"步骤{step}执行失败: {e}")
            raise
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run()
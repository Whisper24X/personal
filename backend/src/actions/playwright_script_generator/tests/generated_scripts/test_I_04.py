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
            page.wait_for_load_state('networkidle')
            page.wait_for_url(re.compile(r"^(?!.*login).*$"))
            expect(page).not_to_have_url(re.compile(r"/login"))
            print(f"步骤{step}: 验证登录成功")
            
            # 步骤6: 点击左侧菜单"商品管理"
            step += 1
            page.wait_for_selector('nav, .menu, .sidebar', timeout=10000)
            product_management_menu = page.get_by_text('商品管理', exact=False).first
            product_management_menu.wait_for(state='visible', timeout=10000)
            product_management_menu.click()
            print(f"步骤{step}: 点击左侧菜单'商品管理'成功")
            
            # 步骤7: 点击进入"平台商品管理"
            step += 1
            platform_product_management = page.get_by_text('平台商品管理', exact=False).first
            platform_product_management.wait_for(state='visible', timeout=10000)
            platform_product_management.click()
            print(f"步骤{step}: 点击进入'平台商品管理'成功")
            
            # 步骤8: 在商品列表中找到商品名称为"测试自研多选一1"
            step += 1
            product_name = "测试自研多选一1"
            product_row = page.locator("tr").filter(has_text=product_name).first
            product_row.wait_for(state='visible', timeout=10000)
            print(f"步骤{step}: 找到商品名称为'{product_name}'成功")
            
            # 步骤9: 点击“查看”按钮
            step += 1
            view_button = product_row.get_by_role("button", name="查看")
            view_button.click()
            print(f"步骤{step}: 点击'查看'按钮成功")
            
            # 步骤10: 选择商品ID为：4bb15e80-0a87-499b-8d9d-b6259459195c
            step += 1
            product_id = "4bb15e80-0a87-499b-8d9d-b6259459195c"
            product_id_element = page.locator("td").filter(has_text=product_id).first
            expect(product_id_element).to_contain_text(product_id)
            print(f"步骤{step}: 选择商品ID为'{product_id}'成功")
            
            # 步骤11: 点击该商品的"上下架"按钮
            step += 1
            shelf_button = product_row.get_by_role("button", name="上下架")
            shelf_button.click()
            print(f"步骤{step}: 点击'上下架'按钮成功")
            
            # 步骤12: 点击"确定"
            step += 1
            confirm_button = page.get_by_role("button", name="确定")
            confirm_button.click()
            print(f"步骤{step}: 点击'确定'按钮成功")
            
            # 步骤13: 验证操作成功
            step += 1
            success_message = page.get_by_role("alert").first
            expect(success_message).to_contain_text("已上架成功" if "上架" in page.url else "已下架成功")
            print(f"步骤{step}: 验证操作成功")
            
            print(f"测试执行成功, 共执行 {step} 个步骤")
        except Exception as e:
            print(f"步骤{step}执行失败: {e}")
            raise
        finally:
            context.close()
            browser.close()

if __name__ == "__main__":
    run()
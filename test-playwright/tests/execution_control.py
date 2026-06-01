"""脚本治理层：统一等待、重试、状态判断，解决脚本不稳定问题。

提供：
- wait_for_ready: 等待元素可见且可交互
- retry_click: 带重试的点击操作
- hover_then_click: hover 后点击（解决隐藏元素问题）
- state_before_after: 操作前后状态对比（用于可断言 Then）
"""
from typing import Optional

from playwright.sync_api import Locator, Page, TimeoutError


def wait_for_ready(locator: Locator, timeout: int = 10000, stable: bool = False) -> None:
    """等待元素可见且可交互（enabled）。

    Args:
        locator: Playwright Locator
        timeout: 超时时间（毫秒）
        stable: 是否等待稳定（如 class 不再变化），默认 False

    Raises:
        TimeoutError: 超时未出现
    """
    locator.wait_for(state="visible", timeout=timeout)
    # 检查 enabled（非 disabled）
    if locator.get_attribute("disabled") == "true":
        raise TimeoutError(f"Element {locator} is disabled after {timeout}ms")
    if stable:
        # 简单稳定检查：等待一小段时间，若 class/属性不变则认为稳定
        initial_class = locator.get_attribute("class") or ""
        import time
        time.sleep(0.2)
        if locator.get_attribute("class") != initial_class:
            # 若变化则再等一次
            time.sleep(0.3)


def retry_click(
    locator: Locator,
    success_check: Optional[Locator] = None,
    max_attempts: int = 2,
    timeout: int = 5000,
) -> None:
    """带重试的点击操作，点击后校验目标出现。

    Args:
        locator: 要点击的元素
        success_check: 点击后应出现的元素（用于校验成功），None 则仅点击
        max_attempts: 最大尝试次数
        timeout: 每次尝试后等待 success_check 的超时时间

    Raises:
        TimeoutError: 所有尝试均失败
    """
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            wait_for_ready(locator, timeout=3000)
            locator.click()
            if success_check:
                success_check.wait_for(state="visible", timeout=timeout)
            return
        except TimeoutError as e:
            last_error = e
            if attempt < max_attempts:
                continue
    raise TimeoutError(f"retry_click failed after {max_attempts} attempts: {last_error}")


def hover_then_click(page: Page, parent_selector: str, child_selector: str, timeout: int = 5000) -> None:
    """先 hover 父元素，再点击子元素（解决 hover/隐藏元素问题）。

    Args:
        page: Playwright Page
        parent_selector: 父元素选择器（需 hover）
        child_selector: 子元素选择器（需点击）
        timeout: 超时时间

    Raises:
        TimeoutError: 超时未出现
    """
    parent = page.locator(parent_selector).first
    wait_for_ready(parent, timeout=timeout)
    parent.hover()
    # 等待子元素出现（hover 后可能延迟显示）
    child = page.locator(child_selector).first
    child.wait_for(state="visible", timeout=timeout)
    child.click()


def state_before_after(
    page: Page, before_selector: str, after_selector: str, action, timeout: int = 10000
) -> dict:
    """操作前后状态对比（用于可断言 Then）。

    Args:
        page: Playwright Page
        before_selector: 操作前的元素选择器
        after_selector: 操作后应出现的元素选择器
        action: 执行的操作（函数）
        timeout: 等待 after 的超时时间

    Returns:
        dict: {"before": bool, "after": bool, "before_text": str, "after_text": str}

    Raises:
        TimeoutError: after 元素未出现
    """
    before_locator = page.locator(before_selector).first
    before_exists = before_locator.is_visible() if before_locator.count() > 0 else False
    before_text = before_locator.text_content() if before_exists else ""

    action()

    after_locator = page.locator(after_selector).first
    after_locator.wait_for(state="visible", timeout=timeout)
    after_exists = after_locator.is_visible()
    after_text = after_locator.text_content() if after_exists else ""

    return {
        "before": before_exists,
        "after": after_exists,
        "before_text": before_text,
        "after_text": after_text,
    }

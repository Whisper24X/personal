"""路径与配置管理：从环境变量或配置读取，缺失时快速失败（解决 PRD 未给路径问题）。

若 PRD 未提供页面路径，脚本应明确失败或 skip，而非静默错误。
"""
import os
import pytest


def get_channel_orders_path() -> str:
    """获取渠道订单管理页面路径（若 PRD 未提供则返回空字符串）。"""
    return os.environ.get("CHANNEL_ORDERS_PATH", "")


def get_real_button_texts() -> dict:
    """获取真实按钮文案（从配置或环境变量，避免 AI 幻觉）。"""
    # 可从环境变量或配置文件读取
    return {
        "新增": os.environ.get("BUTTON_TEXT_ADD", "新增"),
        "保存": os.environ.get("BUTTON_TEXT_SAVE", "保存"),
        "导入": os.environ.get("BUTTON_TEXT_IMPORT", "导入"),
        "渠道配置": os.environ.get("BUTTON_TEXT_CHANNEL_CONFIG", "渠道配置"),
    }


def require_channel_orders_path() -> str:
    """要求渠道订单路径必须配置，否则 skip。

    Returns:
        str: 路径

    Raises:
        pytest.skip: 路径未配置
    """
    path = get_channel_orders_path()
    if not path:
        pytest.skip("PRD 未提供页面路径，请设置环境变量 CHANNEL_ORDERS_PATH")
    return path


def get_base_url_from_config() -> str:
    """从配置获取 BASE_URL（若未配置则使用默认）。"""
    return os.environ.get("E2E_BASE_URL", "https://trip-shadow-test.yangcong345.com/trip/login")

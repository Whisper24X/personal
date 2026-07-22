#!/usr/bin/env python3
"""
批量激活虚拟设备脚本
接口: POST /devices-management/api/devices/IIUG/init/v2

前置条件（已完成）：
  1. 在 devices_management.devices_hangzhi 写入 SN 硬件清单
  2. 在 devices_management.devices 写入设备组织信息

激活参数：
  企业ID : 3529bf8e-787e-491b-9453-9baae86ab77d  (洋葱-平板)
  学校ID : 2d41325c-ce8a-4e79-863c-f68162f103ed  (回归验证学校)
  班级ID : e80ad0bd-629e-49ea-9f28-f695906fc894  (测试1班)
"""

import urllib.request
import urllib.error
import json
import ssl
import time
from datetime import datetime

# ============================================================
# 配置区（按需修改）
# ============================================================
BASE_URL = "https://device-test-api.yangcong345.com"
API_PATH = "/devices-management/api/devices/IIUG/init/v2"

SN_PREFIX = "Q207YJTESTDYW"
SN_START  = 1
SN_END    = 100  # 含

COMPANY_ID = "3529bf8e-787e-491b-9453-9baae86ab77d"   # 洋葱-平板
SCHOOL_ID  = "2d41325c-ce8a-4e79-863c-f68162f103ed"   # 回归验证学校
CLASS_ID   = "e80ad0bd-629e-49ea-9f28-f695906fc894"   # 测试1班

DELAY_BETWEEN_REQUESTS = 0.1   # 秒，避免打爆服务
TIMEOUT = 10                    # 请求超时秒数
# ============================================================


def build_ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def make_sn(index: int) -> str:
    return f"{SN_PREFIX}{index:03d}"


def activate_device(sn: str, ctx) -> dict:
    url = BASE_URL + API_PATH
    body = {
        "snId":      sn,
        "companyId": COMPANY_ID,
        "schoolId":  SCHOOL_ID,
        "classId":   CLASS_ID,
    }
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            return {"sn": sn, "status": "ok", "code": resp.status, "body": resp.read().decode()}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return {"sn": sn, "status": "error", "code": e.code, "body": body}
    except Exception as e:
        return {"sn": sn, "status": "error", "code": -1, "body": str(e)}


def main():
    ctx = build_ssl_ctx()
    sns = [make_sn(i) for i in range(SN_START, SN_END + 1)]
    total = len(sns)

    print(f"{'='*60}")
    print(f"批量激活任务")
    print(f"  设备总数  : {total}")
    print(f"  SN 范围   : {sns[0]} ~ {sns[-1]}")
    print(f"  企业      : {COMPANY_ID}")
    print(f"  学校      : {SCHOOL_ID}")
    print(f"  班级      : {CLASS_ID}")
    print(f"  接口地址  : {BASE_URL + API_PATH}")
    print(f"  开始时间  : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    results = {"ok": [], "error": []}

    for idx, sn in enumerate(sns):
        result = activate_device(sn, ctx)
        status_icon = "✓" if result["status"] == "ok" else "✗"
        print(f"[{idx+1:3d}/{total}] {status_icon} {sn} | HTTP {result['code']} | {result['body'][:80]}")
        results[result["status"]].append(result)
        if idx < total - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    # 汇总报告
    print(f"\n{'='*60}")
    print(f"执行完毕  : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"成功      : {len(results['ok'])}")
    print(f"失败      : {len(results['error'])}")

    if results["error"]:
        print("\n失败明细：")
        for r in results["error"]:
            print(f"  {r['sn']} | HTTP {r['code']} | {r['body'][:100]}")

    # 输出 JSON 报告
    import os
    os.makedirs("apifox-reports", exist_ok=True)
    report_file = f"apifox-reports/batch_activate_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({
            "summary": {
                "total": total,
                "ok": len(results["ok"]),
                "error": len(results["error"]),
                "time": datetime.now().isoformat(),
            },
            "details": results["ok"] + results["error"],
        }, f, ensure_ascii=False, indent=2)
    print(f"\n详细报告已保存: {report_file}")


if __name__ == "__main__":
    main()

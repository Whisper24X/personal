#!/usr/bin/env python3
"""
虚拟设备保活脚本
每隔 INTERVAL 秒刷新 Q207YJTESTDYW* 设备的心跳时间，保持在线状态

用法:
  python3 scripts/keep_devices_online.py             # 默认每 60 秒刷新
  python3 scripts/keep_devices_online.py --interval 30  # 每 30 秒刷新
  python3 scripts/keep_devices_online.py --once       # 只刷新一次就退出
"""

import psycopg2
import time
import sys
import argparse
from datetime import datetime, timezone

DB_DSN = {
    "host":     "10.8.8.110",
    "port":     5433,
    "dbname":   "devices_management",
    "user":     "postgres",
    "password": "7to12pg12",
}

SN_PATTERN = "Q207YJTESTDYW%"


def refresh_heartbeat() -> int:
    now = datetime.now(timezone.utc)
    conn = psycopg2.connect(**DB_DSN)
    cur = conn.cursor()
    cur.execute("""
        UPDATE devices
        SET "statusActive"       = 'line_on',
            "timeLastHeartbeat"  = %s
        WHERE "SNId" LIKE %s
    """, (now, SN_PATTERN))
    count = cur.rowcount
    conn.commit()
    conn.close()
    return count


def main():
    parser = argparse.ArgumentParser(description="虚拟设备保活脚本")
    parser.add_argument("--interval", type=int, default=60, help="刷新间隔（秒），默认 60")
    parser.add_argument("--once", action="store_true", help="只刷新一次就退出")
    args = parser.parse_args()

    print(f"设备保活启动")
    print(f"  目标 SN : {SN_PATTERN}")
    print(f"  刷新间隔: {args.interval}s")
    print(f"  按 Ctrl+C 停止\n")

    while True:
        try:
            count = refresh_heartbeat()
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}] 心跳刷新 {count} 台设备 → statusActive=line_on")
        except Exception as e:
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}] 刷新失败: {e}")

        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()

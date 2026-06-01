#!/usr/bin/env python3
"""
从智齿工单 API 导出：受理客服组、受理客服组 ID、受理客服、受理客服 ID 的对应关系。

依据开放平台工单接口（需 header: token）：
- get_data_dict → group_list
- query_tickets → 按 deal_agent_groupid 分页（创建时间窗口单次不超过 1 个月）
- get_ticket_by_id → 取 deal_agentid / deal_groupid（以详情为准）

说明：关系来自「时间窗内曾作为该组受理方出现的工单」；同一人多名或重名时以坐席 ID 去重。
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from urllib.parse import urlencode


def curl_get(url: str, headers: dict[str, str]) -> bytes:
    cmd = ["curl", "-sS", "-G", url]
    for k, v in headers.items():
        cmd.extend(["-H", f"{k}: {v}"])
    return subprocess.check_output(cmd, timeout=120)


def curl_get_qs(url: str, query: dict[str, str], headers: dict[str, str]) -> bytes:
    full = f"{url}?{urlencode(query)}"
    return curl_get(full, headers)


def load_json(raw: bytes) -> dict:
    return json.loads(raw.decode("utf-8", errors="replace"))


def month_windows(
    end_s: str,
    *,
    months: int,
    day_span: int = 30,
) -> list[tuple[str, str]]:
    """
    智齿 query_tickets 要求单次创建时间跨度不超过约 1 个月。
    从 end_s 往前切 months 段，每段 day_span 天（默认 30），右闭区间到当日结束。
    """
    end_dt = datetime.strptime(end_s, "%Y-%m-%d %H:%M:%S")
    out: list[tuple[str, str]] = []
    cur_end = end_dt
    for _ in range(max(1, months)):
        cur_start = cur_end - timedelta(days=day_span)
        cur_start = cur_start.replace(hour=0, minute=0, second=0)
        out.append((cur_start.strftime("%Y-%m-%d %H:%M:%S"), cur_end.strftime("%Y-%m-%d %H:%M:%S")))
        cur_end = cur_start - timedelta(seconds=1)
    return out


def main() -> int:
    token_url = os.environ.get("SOBOT_TOKEN_URL", "https://hardwarecrawler.yc345.tv/api/ticket/token")
    base = os.environ.get("SOBOT_TICKET_BASE", "https://www.sobot.com/api/ws/5/ticket")
    end_default = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    end = os.environ.get("SOBOT_CREATE_END", end_default)
    months = int(os.environ.get("SOBOT_MONTH_WINDOWS", "6"))
    windows = month_windows(end, months=months)

    token = subprocess.check_output(["curl", "-sS", token_url], timeout=60).decode().strip()
    if not token:
        print("无法获取 token", file=sys.stderr)
        return 1
    h = {"token": token}

    dd = load_json(curl_get(f"{base}/get_data_dict", h))
    if dd.get("ret_code") != "000000":
        print(dd, file=sys.stderr)
        return 1
    groups = dd["item"]["group_list"]

    pairs: dict[tuple[str, str], tuple[str, str, str, str]] = {}

    for win_start, win_end in windows:
        for g in groups:
            gid = str(g.get("groupid") or "")
            gname = str(g.get("group_name") or "")
            seen_name: set[str] = set()
            page = 1
            page_count = 1

            while page <= page_count and page <= 500:
                q = {
                    "create_start_datetime": win_start,
                    "create_end_datetime": win_end,
                    "deal_agent_groupid": gid,
                    "page_no": str(page),
                    "page_size": "50",
                }
                data = load_json(curl_get_qs(f"{base}/query_tickets", q, h))
                if data.get("ret_code") != "000000":
                    break
                page_count = int(data.get("page_count") or 1)
                items = data.get("items") or []

                for it in items:
                    aname = it.get("deal_agent_name")
                    tid = it.get("ticketid")
                    if not tid or not aname or not str(aname).strip():
                        continue
                    aname = str(aname).strip()
                    if aname in seen_name:
                        continue

                    det = load_json(
                        curl_get_qs(
                            f"{base}/get_ticket_by_id",
                            {"ticketid": str(tid)},
                            h,
                        )
                    )
                    seen_name.add(aname)
                    if det.get("ret_code") != "000000":
                        continue
                    item = det.get("item") or {}
                    aid = str(item.get("deal_agentid") or "").strip()
                    if not aid:
                        continue
                    dgid = str(item.get("deal_groupid") or "").strip() or gid
                    dgname = str(item.get("deal_group_name") or "").strip() or gname
                    dname = str(item.get("deal_agent_name") or "").strip() or aname
                    key = (dgid, aid)
                    pairs[key] = (dgname, dgid, dname, aid)

                page += 1

    rows = sorted(pairs.values(), key=lambda r: (r[0], r[2]))
    print("受理客服组\t受理客服组ID\t受理客服\t受理客服ID")
    for dgname, dgid, dname, aid in rows:
        print(f"{dgname}\t{dgid}\t{dname}\t{aid}")
    win_desc = "; ".join(f"{a}~{b}" for a, b in windows)
    print(f"(共 {len(rows)} 条去重关系；合并 {len(windows)} 个创建时间窗: {win_desc})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

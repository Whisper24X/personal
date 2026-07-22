---
name: feishu-testcase-batch-ops
description: 用 meegle CLI 批量操作飞书项目（Meego/Meegle）某个视图里的测试用例，包括批量流转状态（如全部改为「评审通过」）、批量按优先级打标签或改写自定义字段（如给 P0/P1 打「冒烟用例」标签）。Use when the user gives a 飞书项目/Meegle 视图 URL 并要求对视图内用例批量改状态、批量改字段、按优先级筛选打标签、批量评审通过、批量打冒烟用例/回归标签 等。关键词：飞书项目、meegle、测试用例、视图、批量改状态、评审通过、打标签、冒烟用例、优先级。
disable-model-invocation: true
---

# 飞书项目测试用例批量操作

用 `meegle` CLI 对飞书项目某个**视图（view）里的测试用例**做批量操作。本 skill 是从实际跑通的工作流沉淀而来，已规避若干坑。

> 依赖：本机已安装 `meegle` CLI（`/opt/homebrew/bin/meegle`）。通用命令规范、字段值格式、MQL 等见个人 skill `~/.claude/skills/meegle/`；本文件聚焦"视图内用例批量改"这个高频场景。

## 适用场景

- 给一个视图里的所有用例批量流转状态（待评审 → 评审通过 等）
- 按优先级（P0/P1/P2）筛选用例，批量打标签或改某个自定义字段
- 任何"先用 `view get` 圈出一批工作项，再循环调写命令"的批量编辑

## 标准流程

```
0. 解析 URL    -> meegle url decode
1. 鉴权        -> meegle auth status / auth login --device-code
2. 拿 project_key -> meegle project search
3. 拉视图数据  -> meegle view get（翻页 + --fields 取所需字段）
4. 定位写法    -> 状态: list-state-transitions 拿 transition_id
                  字段: workitem meta-fields 拿 field_key + option_id
5. 单条验证    -> 先对 1 条跑通，确认返回与回查
6. 批量执行    -> 简单 for 循环
7. 核对        -> 再 view get + jq/awk 统计
```

### 0. 解析 URL（禁止自己截路径）

```bash
meegle url decode --url '<视图URL>' --format json
```

测试用例视图通常返回 `url_kind=view_workitem`、`work_item_type=test_cases`、`view_id=...`、`simple_name=...`。保存 `simple_name` 和 `view_id`。

### 1. 鉴权（关键坑）

```bash
meegle auth status --format json
```

未登录时，**这个环境没有交互式浏览器回调**，必须用设备码方式：

```bash
meegle auth login --device-code --host project.feishu.cn
```

该命令会打印授权链接 + 授权码（usercode）+ 二维码，**把链接和授权码原样发给用户**让其在浏览器完成，然后等待命令自身返回成功。普通 `auth login`（无 `--device-code`）会直接报错 "requires an interactive browser callback"。

### 2. simple_name → 权威 project_key

```bash
meegle project search --project-key <simple_name> --format json
```

取 `projects[0].project_key`。同名空间可能多个，务必用此命令转权威 key，不要直接拿 simple_name 当 project_key。

### 3. 拉视图数据（翻页 + 取额外字段）

`view get` **每页 50 条**，`pagination.has_more=true` 时要继续翻页。默认只回少量基础字段；要拿优先级 / 自定义字段，必须用 `--fields`（可重复传多个）。

```bash
# 取每页用例的 id / 状态 / 优先级 / 标签字段
meegle view get --view-id <view_id> --project-key <PK> --page-num 1 \
  --fields priority --fields <自定义字段key> --format json \
| jq -r '.pagination as $p
  | "TOTAL=\($p.total) HAS_MORE=\($p.has_more)",
    (.work_item_list[]
     | "\(.work_item_attribute.work_item_id)\t\(.work_item_attribute.work_item_status.key)\t\([.work_item_fields[]?|select(.key=="priority")|.value]|@json)\t\(.work_item_attribute.work_item_name)")'
```

字段提取要点：
- 状态在 `work_item_attribute.work_item_status.key`（如 `not_reviewed` / `review_passed`）。
- `work_item_mod` 标明 `状态流` / `节点流` —— 测试用例是**状态流**，走 `workflow transition-state`（不要用节点流的 `workflow transition`）。
- 优先级在 `work_item_fields` 里 `key=="priority"`，值形如 `[{"label":"P0","value":"option_1"}]`。

### 4. 定位写法

**改状态（状态流）—— 拿 transition_id：**

```bash
meegle workflow list-state-transitions --work-item-id <任一用例ID> \
  --work-item-type test_cases --user-key <当前用户userkey> \
  --project-key <PK> --format json
```

返回 `transition[]`，每项 `state_key` + `id`。匹配目标状态（如 `review_passed`「评审通过」）拿到 `id`。同一工作项类型、同一起始状态的 `transition_id` 通用，可复用到全部同状态用例。当前用户 userkey 用 `meegle user search --user-keys 'current_login_user()' --project-key <PK> --format json` 获取。

**改字段 / 打标签 —— 拿 field_key 与 option_id：**

```bash
meegle workitem meta-fields --page-num 1 --project-key <PK> \
  --work-item-type test_cases --format json \
| jq '.list[] | {field_key,field_name,field_type,option}'
```

找到目标字段（如「标签」是 `multi-select`，选项含「冒烟用例」「回归用例」）。注意飞书这里 `option_id` 常等于中文选项名本身。

### 5. 单条验证（务必先做）

批量前先对 1 条跑通并回查，避免 50 条全错：

```bash
# 状态：单条流转
meegle workflow transition-state --work-item-id <ID> --project-key <PK> \
  --transition-id <TID> --format json        # 成功返回 "success"

# 字段：单条写入（multi-select 见下方"字段值格式"）
meegle workitem update --work-item-id <ID> --project-key <PK> \
  --fields '{"field_key":"<字段key>","field_value":"[{\"option_id\":\"冒烟用例\"}]"}' --format json

# 回查确认写入
meegle workitem get --work-item-id <ID> --project-key <PK> --fields <字段key> --format json
```

### 6. 批量执行（用简单 for 循环）

> 🚨 **坑**：复杂的多行 shell 脚本（含 `ok=$((ok+1))`、`failed_ids=...`、`grep -qiE` 混用）在本环境 zsh 下会静默失败（退出 1、无输出）。**改用最简 `for` 循环**，每行打印 id + 命令输出，再用 `grep -c` 统计，稳定可靠。

```bash
# 批量改状态
for id in <ID1> <ID2> ...; do
  printf '%s ' "$id"
  meegle workflow transition-state --work-item-id "$id" --project-key <PK> --transition-id <TID> --format json
  echo
done | tee /tmp/trans.log >/dev/null
echo "成功: $(grep -c success /tmp/trans.log) / 总: $(grep -cE '^[0-9]' /tmp/trans.log)"

# 批量打标签（multi-select）
for id in <P0/P1 的 ID 列表>; do
  printf '%s ' "$id"
  meegle workitem update --work-item-id "$id" --project-key <PK> \
    --fields '{"field_key":"<字段key>","field_value":"[{\"option_id\":\"冒烟用例\"}]"}' --format json
  echo
done | tee /tmp/tag.log >/dev/null
grep -iE 'error|err_msg|denied|fail' /tmp/tag.log || echo "(无报错)"
```

按优先级筛选：从第 3 步的输出里挑出 `priority.label` 为 `P0`/`P1` 的 id 作为打标签列表，`P2` 不处理。

### 7. 核对（必做）

重新拉视图统计，确认状态全改、标签按预期落到对应优先级：

```bash
PK=<PK>; VID=<view_id>
{ meegle view get --view-id $VID --project-key $PK --page-num 1 --fields priority --fields <字段key> --format json;
  meegle view get --view-id $VID --project-key $PK --page-num 2 --fields priority --fields <字段key> --format json; } \
| jq -r '.work_item_list[]
   | (.work_item_attribute.work_item_status.key) as $st
   | ([.work_item_fields[]?|select(.key=="priority")|.value]|flatten|map(select(type=="object"))|(.[0].label // "NA")) as $pri
   | ([.work_item_fields[]?|select(.key=="<字段key>")|.value]|flatten|map(select(type=="object")|.label)|join(",")) as $tag
   | [$st,$pri,$tag]|@tsv' > /tmp/verify.tsv
echo "状态分布:"; cut -f1 /tmp/verify.tsv | sort | uniq -c
echo "优先级分布:"; cut -f2 /tmp/verify.tsv | sort | uniq -c
awk -F'\t' '$2=="P0"||$2=="P1"{t++; if($3 ~ /冒烟用例/) ok++} END{print "P0P1="t" 已打标签="ok}' /tmp/verify.tsv
```

## 字段值格式（写命令时最易错）

`workitem update --fields` 的 `field_value` 协议层是**字符串**；数组/对象**必须先 JSON.stringify**，否则报 `need STRING type, but got: LIST/MAP`。

| 字段类型 | field_value 示例 |
|---|---|
| text/number/bool | `"100"` / `"true"` |
| user | `"7509072868295085608"` |
| multi-user | `"[\"key1\",\"key2\"]"`（stringified） |
| select/radio | 纯 option_id 字符串，如 `"option_1"` |
| multi-select（标签） | `"[{\"option_id\":\"冒烟用例\"}]"`（stringified 对象数组） |

## jq 注意

- jq **不支持未加引号的中文对象键**（会报 "May need parentheses around object key expression"）。统计时用英文 key 或改走 `@tsv` + `awk`。
- 字段 `value` 结构不统一（可能是对象数组 / 字符串 / null），用 `flatten | map(select(type=="object"))` 容错，避免 "Cannot index string with string"。

## 易错点速查

| 坑 | 处理 |
|---|---|
| `auth login` 报需要交互式浏览器 | 改用 `--device-code`，把授权链接发给用户 |
| `view get` 只回了一部分用例 | `pagination.has_more` 为 true 时翻页（每页 50） |
| `view get` 没有优先级/自定义字段 | 用 `--fields` 显式指定（可重复） |
| 用例改状态用了 `workflow transition` 失败 | 测试用例是状态流，用 `workflow transition-state` |
| 多行批量脚本静默退出码 1 | 改用最简 `for` 循环 + `printf`/`echo` |
| multi-select 报 `got: LIST` | field_value 整体是字符串，内部数组要 stringify |

## 完成后汇报

向用户给出表格：用例总数、状态流转成功数、优先级分布、按优先级打标签的成功数、未处理项（如 P2），并附最终核对结果。

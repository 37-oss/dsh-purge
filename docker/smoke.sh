#!/usr/bin/env bash
# 在容器里跑完就退出，不写宿主任何目录。
# 刻意不用 set -e：每一步自己判，失败时把原因打清楚（CI 日志里能直接看到）。
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== 0. 环境 =="
node -v || fail "容器里没有 node"
echo "DSH_HOME=$DSH_HOME (空目录)  DSH_BASE=$DSH_BASE (不存在)"

echo "== 1. 语法检查 =="
npm run check || fail "npm run check 没过"

echo "== 2. 结构测试 =="
npm test || fail "npm test 没过"

echo "== 3. 插件入口可加载（不触发 apply） =="
node --input-type=module -e "const m = await import('./lib/index.js'); if (m.name !== 'dsh-purge') { console.error('bad export', m.name); process.exit(1); } console.log('entry ok', m.name, JSON.stringify(m.inject));" \
  || fail "lib/index.js 加载失败"

echo "== 4. CLI 帮助 =="
node bin/dsh-purge.js --help > /tmp/help.log 2>&1 || fail "--help 非零退出"
grep -q -- "--apply" /tmp/help.log || fail "--help 里没有 --apply"
echo "ok: --help"

echo "== 5. CLI 自检（空环境，什么都不清） =="
node bin/dsh-purge.js --status > /tmp/status.log 2>&1
status_code=$?
echo "退出码 $status_code（空环境允许非零，只要它说清楚找不到宿主）"
head -n 10 /tmp/status.log || true
if [ "$status_code" -ne 0 ]; then
  grep -qiE "找不到|not found|missing|ERROR" /tmp/status.log || fail "--status 退出码 $status_code 且没有说明原因"
fi

echo "== 6. 反向举证：没有宿主时 --apply 必须被拒 =="
if node bin/dsh-purge.js --apply > /tmp/apply.log 2>&1; then
  cat /tmp/apply.log
  fail "空环境下 --apply 竟返回成功"
fi
cat /tmp/apply.log | head -n 5 || true
grep -qiE "ERROR|找不到|not found" /tmp/apply.log || fail "--apply 被拒但没给出原因"
echo "ok: apply 被拒，未写任何文件"

echo "== 7. 打包清单 =="
npm pack --dry-run > /tmp/pack.log 2>&1 || fail "npm pack --dry-run 失败"
tail -n 3 /tmp/pack.log || true

echo "== 全部通过 =="

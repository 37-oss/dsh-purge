#!/usr/bin/env bash
# 在容器里跑完就退出，不写宿主任何目录。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 0. 环境 =="
node -v
echo "DSH_HOME=$DSH_HOME (空目录)  DSH_BASE=$DSH_BASE (不存在)"

echo "== 1. 语法 + 结构测试 =="
npm run check
npm test

echo "== 2. 插件入口可加载（不触发 apply） =="
node --input-type=module -e "const m = await import('./lib/index.js'); if (m.name !== 'dsh-purge') { console.error('bad export'); process.exit(1); } console.log('entry ok', m.name, JSON.stringify(m.inject));"

echo "== 3. CLI 自检（空环境，什么都不清） =="
node bin/dsh-purge.js --help > /dev/null
node bin/dsh-purge.js --status | head -n 8

echo "== 4. 反向举证：没有宿主时 --apply 必须被拒 =="
if node bin/dsh-purge.js --apply > /tmp/apply.log 2>&1; then
  echo "FAIL: 空环境下 apply 竟返回成功"
  cat /tmp/apply.log
  exit 1
fi
grep -q "ERROR" /tmp/apply.log && echo "ok: apply 被拒（找不到宿主，未写任何文件）"

echo "== 5. 打包清单 =="
npm pack --dry-run 2>&1 | tail -n 5

echo "== 全部通过 =="

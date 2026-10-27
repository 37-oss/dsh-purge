import test from "node:test";
import assert from "node:assert/strict";

const core = await import("../lib/core.js");
const { openSlot } = await import("../lib/table-read.js");

const ALL = core.ALL_PATCHES;

/** 补丁有两种写法：replacements[{pattern,replace}] 或 patterns[] + replace + marker。统一成规则列表。 */
function rulesOf(p) {
  if (Array.isArray(p.replacements) && p.replacements.length > 0) {
    return p.replacements.map((r) => ({ pattern: r.pattern ?? r.from, replace: r.replace ?? r.to }));
  }
  if (Array.isArray(p.patterns) && p.patterns.length > 0) {
    return p.patterns.map((pattern) => ({ pattern, replace: p.replace }));
  }
  return [];
}

test("补丁注册表：id 唯一，字段齐全", () => {
  assert.ok(Array.isArray(ALL) && ALL.length >= 80, "ALL_PATCHES 数量异常：" + (ALL?.length ?? "not array"));
  const ids = ALL.map((p) => p.id);
  const seen = new Set();
  for (const id of ids) {
    assert.equal(typeof id, "number", "补丁 id 必须是数字：" + id);
    assert.ok(!seen.has(id), "补丁 id 重复：#" + id);
    seen.add(id);
  }
  for (const p of ALL) {
    assert.ok(p.name && typeof p.name === "string", "#" + p.id + " 缺 name");
    assert.ok(p.layer && p.layer_en, "#" + p.id + " 缺 layer / layer_en");
    assert.ok(p.desc && typeof p.desc === "string", "#" + p.id + " 缺 desc（清洗页要显示）");
    const rules = rulesOf(p);
    assert.ok(rules.length > 0, "#" + p.id + " 没有任何替换规则（replacements 或 patterns+replace 二选一）");
    let noop = 0;
    for (const r of rules) {
      const pat = r.pattern;
      const rep = r.replace;
      assert.ok(typeof pat === "string" || pat instanceof RegExp, "#" + p.id + " 的 pattern 既不是字符串也不是 RegExp");
      assert.ok((typeof pat === "string" ? pat.length : pat.source.length) > 0, "#" + p.id + " 的 pattern 为空");
      assert.equal(typeof rep, "string", "#" + p.id + " 的 replace 不是字符串");
      const patText = typeof pat === "string" ? pat : "/" + pat.source + "/" + pat.flags;
      if (patText === rep) noop += 1;
    }
    assert.ok(noop < rules.length, "#" + p.id + " 的所有替换规则 pattern 与 replace 完全相同（整条空转）");
    if (p.rel) {
      assert.ok(Array.isArray(p.rel) && p.rel.length > 0, "#" + p.id + " 的 rel 应为路径片段数组");
      for (const seg of p.rel) assert.ok(!/^[a-zA-Z]:|\//.test(seg), "#" + p.id + " 的 rel 写死了盘符或绝对路径：" + seg);
    }
  }
});

test("加标记的补丁必须给 markers，否则重复 apply 会叠层", () => {
  for (const p of ALL) {
    if (p.skipIfMarked) {
      assert.ok(Array.isArray(p.markers) && p.markers.length > 0, "#" + p.id + " skipIfMarked 但没有 markers");
    }
  }
});

test("默认提示词 slot 能解开且内容稳定", () => {
  const a = openSlot();
  const b = openSlot();
  assert.equal(a, b, "两次解读结果不一致，asset-table.js 可能被手改坏");
  assert.ok(a.length > 5000, "解读出来的提示词只有 " + a.length + " 字符，太小");
  assert.ok(!/\uFFFD/.test(a), "出现替换字符，编码坏了");
});

test("清洗页分组：升级链合并后仍是完整可展示的列表", () => {
  assert.equal(typeof core.groupPatchesForDisplay, "function");
  const status = {};
  for (const p of ALL) status[p.id] = "pending";
  const rows = core.groupPatchesForDisplay(ALL, status);
  assert.ok(Array.isArray(rows) && rows.length > 0, "分组结果为空");
  const covered = new Set();
  for (const row of rows) {
    assert.ok(row.id && row.title && row.status, "分组行缺字段：" + JSON.stringify(row).slice(0, 120));
    assert.ok(Array.isArray(row.ids) && row.ids.length > 0, "#" + row.id + " 没有 ids");
    for (const id of row.ids) covered.add(id);
  }
  assert.ok(covered.size <= ALL.length, "分组覆盖的 id 比补丁总数还多");
  assert.ok(covered.size >= ALL.length * 0.8, `分组只覆盖了 ${covered.size}/${ALL.length} 条，清洗页会漏项`);
});

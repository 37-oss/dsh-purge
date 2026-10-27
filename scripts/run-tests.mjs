/**
 * 跨版本稳定的测试入口：自己枚举 tests/*.test.mjs 再交给 node --test。
 * （node --test <目录> 在部分 Node 版本上不认目录参数，glob 也是 22+ 才有。）
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = path.join(root, "tests");
const files = readdirSync(testsDir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => path.join(testsDir, f));

if (files.length === 0) {
  process.stderr.write("tests/ 里没有 *.test.mjs\n");
  process.exit(1);
}

const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit", cwd: root });
process.exit(r.status ?? 1);

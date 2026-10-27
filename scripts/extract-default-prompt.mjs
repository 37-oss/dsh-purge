/**
 * 把已封进 lib/asset-table.js 的默认提示词解出来，写成可编辑的明文
 * lib/default-prompt-inject.md（该文件在 .gitignore 里，不进仓库）。
 *
 * 用法：node scripts/extract-default-prompt.mjs [--force]
 * 之后改明文 → npm run embed-prompt → 提交 lib/asset-table.js。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openSlot } from "../lib/table-read.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dest = path.join(root, "lib", "default-prompt-inject.md");
const force = process.argv.includes("--force");

if (fs.existsSync(dest) && !force) {
  process.stdout.write("exists, skip: " + path.relative(root, dest) + "\\n(pass --force to overwrite)\\n");
  process.exit(0);
}

const text = openSlot();
if (!text.trim()) {
  process.stderr.write("asset-table.js 解不出内容：先确认没在别处改写 SLOT/MASK/TAG/IV\\n");
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, text, "utf8");
process.stdout.write("wrote " + path.relative(root, dest) + " bytes=" + Buffer.byteLength(text) + "\\n");

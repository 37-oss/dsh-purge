import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));

test("package.json: fork 只改发布/更新指向，不动包名", () => {
  assert.equal(pkg.name, "dsh-purge");
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.main, "lib/index.js");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
});

test("package.json: 安装与仓库地址指向自己的 fork", () => {
  const urls = [pkg.repository?.url, pkg.homepage, pkg.bugs?.url, pkg.dsh?.install?.tarball, pkg.dsh?.install?.zip, pkg.dsh?.install?.git].join(" ");
  assert.ok(urls.length > 0, "缺 repository/homepage/dsh.install");
  const owner = (pkg.repository?.url || "").match(/github\.com[/:]([^/]+)\//)?.[1];
  assert.ok(owner, "repository.url 里解析不出 owner");
  for (const u of [pkg.homepage, pkg.bugs?.url, pkg.dsh.install.tarball, pkg.dsh.install.zip, pkg.dsh.install.git]) {
    assert.ok(String(u).includes(owner), `这条地址还指着别人：${u}`);
  }
});

test("署名没有被拿掉（LICENSE / README 保留上游作者与来源）", () => {
  const lic = read("LICENSE");
  assert.match(lic, /YuJunZhiXue/);
  assert.match(lic, /商业/);
  const readme = read("README.md");
  assert.ok(/署名/.test(readme), "README 里没有任何署名说明");
  assert.ok(readme.includes("YuJunZhiXue/dsh-purge"), "README 没写上游来源仓库");
  assert.ok(readme.includes("LICENSE"), "README 没链到 LICENSE");
});

test("exports 与 files 里写到的路径真实存在", () => {
  const paths = new Set();
  const walk = (v) => {
    if (typeof v === "string") paths.add(v.replace(/^\.\//, ""));
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(pkg.exports);
  for (const p of paths) {
    if (p === "./package.json" || p === "package.json") continue;
    assert.ok(fs.existsSync(path.join(root, p)), `exports 指向不存在的文件：${p}`);
  }
  for (const entry of pkg.files) {
    if (entry.startsWith("!")) continue;
    assert.ok(fs.existsSync(path.join(root, entry)), `files 里列了不存在的路径：${entry}`);
  }
});

test("cordis.patch.yml 声明了插件本体、演练台三件套", () => {
  const yml = read("cordis.patch.yml");
  const need = ["- id: dsh-purge", "name: 'dsh-purge'", "name: dsh-purge/redteam", "name: dsh-purge/redteam/store", "name: dsh-purge/redteam/ui", "inject: [systemPrompt, tools]"];
  for (const n of need) assert.ok(yml.includes(n), `cordis.patch.yml 缺：${n}`);
  for (const exp of ["./redteam", "./redteam/store", "./redteam/ui"]) {
    assert.ok(pkg.exports[exp], `package.json exports 缺 ${exp}（bundle 会装不上）`);
  }
});

test("client.js 的演练台嵌入标记完整且顺序正确", () => {
  const client = read("client.js");
  const BEGIN = "/* __DSH_PURGE_DRILL_BEGIN__ */";
  const END = "/* __DSH_PURGE_DRILL_END__ */";
  const b = client.indexOf(BEGIN);
  const e = client.indexOf(END);
  assert.ok(b > 0, "缺 BEGIN 标记");
  assert.ok(e > b, "缺 END 标记或顺序反了");
  assert.equal(client.split(BEGIN).length, 2, "BEGIN 标记重复");
  assert.ok(!/\r\n/.test(client), "client.js 出现 CRLF，构建脚本按 LF 切标记");
});

test("随包技能与预设没被删空", () => {
  const skills = fs.readdirSync(path.join(root, "skills", "redteam")).filter((f) => f.endsWith(".md"));
  assert.ok(skills.length >= 15, `skills/redteam 只剩 ${skills.length} 个`);
  for (const f of skills) {
    const size = fs.statSync(path.join(root, "skills", "redteam", f)).size;
    assert.ok(size > 200, `skills/redteam/${f} 太小，可能被截断`);
  }
  for (const f of ["presets/redteam/agent.cordis.yml", "presets/redteam/preset.yml"]) {
    assert.ok(fs.statSync(path.join(root, f)).size > 100, `${f} 异常`);
  }
});

test("README 的安装命令是 dsh plugin add 的 git 短形式", () => {
  const readme = read("README.md");
  assert.ok(readme.includes("dsh plugin --profile web add github:37-oss/dsh-purge"), "README 缺 web 端短安装命令");
  assert.ok(readme.includes("dsh plugin --profile desktop add github:37-oss/dsh-purge"), "README 缺桌面端短安装命令");
  assert.ok(readme.includes("#v1.1."), "README 没写固定 tag 的写法");
});

test("发版同时产出 .tar.gz（dsh plugin add <tarball> 只收 tgz/tar.gz）", () => {
  const yml = read(".github/workflows/release.yml");
  assert.ok(yml.includes("--format=tar.gz"), "release.yml 没有打 tar.gz");
  assert.ok(yml.includes("--format=zip"), "release.yml 没有打 zip");
  assert.ok(yml.includes("gh release upload \"$tag\" \"$zip\" \"$tgz\""), "release.yml 没同时上传两个包");
  assert.ok(!yml.includes("YuJunZhiXue"), "release.yml 里还留着上游仓库地址");
});

test("release-notes.md 首行与 package.json 版本一致（发版 CI 会卡这条）", () => {
  const first = read("release-notes.md").split(/\r?\n/)[0].trim();
  assert.equal(first, "# " + pkg.version);
});

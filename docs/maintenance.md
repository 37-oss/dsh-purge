# dsh-purge 自维护手册（fork: 37-oss/dsh-purge）

这份文档只讲一件事：**你自己的 fork 怎么改、怎么验、怎么发**，且验证过程不碰你本机装着的 dsh。

---

## 0. 先明确 fork 的定位

| 事项 | 结论 |
| --- | --- |
| 上游 | `YuJunZhiXue/dsh-purge`（作者 小杨）。当前代码基线 = 上游 `1.1.71` |
| 许可 | 上游 `LICENSE` 是**商业软件许可**，不是 MIT；允许你自己装机用、允许本机评测，不允许公开再分发源码 / 改名去署名 / 卖 |
| 所以这个 fork 的正确姿势 | **私有仓库 + 自用维护线**。改身份指针（更新源、安装地址）、改补丁、改提示词都行；**署名、LICENSE、来源链接保留不动** |
| 不要做的事 | 把改过的源码公开推到公开仓库、去掉 README「署名要求」、把 `client.js` 里的来源链接替换成自己 |

要商用再分发，按上游 `LICENSE-COMMERCIAL.md` 去谈授权。

---

## 1. 仓库与分支

已配好的 remote：

```
origin    https://github.com/37-oss/dsh-purge.git   # 你的 fork，推这里
upstream  https://github.com/76hvc/dsh-purge.git    # 直接父仓库（你的 fork 来源）
root      https://github.com/YuJunZhiXue/dsh-purge  # 原作者，真源头
```

分支约定：

| 分支 | 用途 |
| --- | --- |
| `master` | 发版线。`package.json` 版本 + `release-notes.md` 首行必须同步，push 即触发 Release |
| `dev` | 日常改动。改完 → CI 绿 → 合进 master |

```sh
git switch dev                 # 干活
git push -u origin dev         # 首次
# 满意后
git switch master && git merge --no-ff dev && git push
```

推不上去就配凭据：SSH（`git remote set-url origin git@github.com:37-oss/dsh-purge.git`）或 PAT。

---

## 2. 代码地图：改东西先看这张表

| 层 | 文件 | 作用 |
| --- | --- | --- |
| **默认提示词（加密 slot）** | 生成物 `lib/asset-table.js`；加解密 `lib/table-key.js` / `lib/table-read.js`；打包脚本 `scripts/embed-default-prompt.mjs` | 提示词框里的默认值 + 每轮身份注入。明文源 `lib/default-prompt-inject.md` 被 `.gitignore` 排除，只提交生成的 `asset-table.js` |
| **补丁注册表** | `lib/core.js`：`PATCHES`(L2569 提示词层) / `CODE_PATCHES`(L2855) / `ENGINE_PATCHES`(L2896) / `NEW_TOOL_PATCHES`(L3168)；合并成 `ALL_PATCHES`(L6079，当前 **86 条**，id 1–92) | 把宿主 `@deepseek-ai/*` 的文件按字符串替换。状态、幂等、分组展示都在这里 |
| **插件本体** | `lib/index.js`：`name`(L37) / `inject`(L41) / `registerPromptSections`(L345) / `apply`(L1420) / 模型工具 `purge_status``purge_apply``purge_revert`(L1588/1609/1645) | 会话注入、工具注册、面板后端接口 |
| **侧栏 UI** | 生成物 `client.js`（500KB）；源码 `lib/redteam/client.js` + `scripts/build-client.mjs` + `scripts/patch-client-dock.mjs` | 「清洗」「演练台」两页。`client.js` 是官方 client bundle 打补丁 + 内嵌演练台，**别手改** |
| **演练台后端** | `lib/redteam/*`（`store-core.js` SQLite，数据落 `$DSH_HOME/redteam`） | 资产库、技能、评分规则、报告 |
| **随包资产** | `presets/redteam/*`、`skills/redteam/*.md` | 预设与红队技能，装插件时铺到宿主目录 |
| **宿主挂载** | `cordis.patch.yml` | 装插件时插入 `dsh-purge` / `dsh-purge/redteam` / `…/store` / `…/ui` 四条 |
| **CLI** | `bin/dsh-purge.js` | `--status --apply --revert --uninstall --edit` |
| **自更新** | `lib/update.js`（`REPO` 常量，已改指你的 fork）、`lib/official-update.js`（跟官方 harness 版本） | 这条决定「更新」按钮去谁家拉包 |

---

## 3. 六种最常见的改法

### 3.1 改默认提示词（最高频）

仓库里**没有**明文提示词，只有加密后的 `asset-table.js`。先解出来：

```sh
npm run extract-prompt          # 生成 lib/default-prompt-inject.md（走 openSlot()，21803 字符）
# 改 lib/default-prompt-inject.md
npm run embed-prompt            # 重新封装，重写 lib/asset-table.js（每次随机 salt，diff 会变，正常）
npm run verify
```

规矩：

- 只提交 `lib/asset-table.js`。`lib/default-prompt-inject.md` 在 `.gitignore` 里，不进库（否则等于把身份明文公开）。
- `embed-prompt` 每次产出都不同（随机 `MASK`/`IV`），别因此怀疑改坏了 —— 用 `npm test` 里的 slot 往返断言确认。
- 改了明文没跑 `embed-prompt`，运行期读到的还是旧提示词，`tests/patches.test.mjs` 会抓「解不出来/太短」。

### 3.2 加一条补丁

在 `lib/core.js` 四个数组之一追加对象，字段照抄邻居：

```js
{
  id: 93,                          // 不复用旧 id；清洗页、备份链、installed-rev 都按 id 认
  name: "XXX_MARKER",
  layer: "代码", layer_en: "Code",  // 提示词 / 代码 / 引擎 / 新工具
  desc: "一句话说明，清洗页直接显示",
  file: "agent-instructions",      // 目标包名；数组表示多包
  rel: ["lib", "index.js"],        // 相对路径片段，别写盘符
  skipIfMarked: true,              // 幂等：已带标记就跳过
  markers: ["[dsh-purge-92] xxx"], // skipIfMarked 必须有，否则每次 apply 叠一层
  replacements: [
    { pattern: "旧的官方原文", replace: "新的内容 /* [dsh-purge-93] */" },
  ],
}
```

要点：

- `pattern` 是**官方文件里的原文**。官方升版改一行字，这条就打不中 → 状态 `pending`，不会乱改（见 README「说明」）。改补丁 = 拿新版官方文件重新抄原文。
- `pattern` 与 `replace` 完全相同 = 空转，`tests/patches.test.mjs` 会报。
- 同一件事的多次升级用「升级链」写法（旧值→新值多条 replacement），展示时由 `groupPatchesForDisplay` 合成一行。
- 加完跑 `npm test`，再去容器里验证。

### 3.3 改模型工具 / 注入逻辑

`lib/index.js`：`purge_status`/`purge_apply`/`purge_revert` 三个工具的定义在 L1588–1665 一带，工具描述文案在同处；注入段组装在 `registerPromptSections`（L345）。`inject` 数组保持 `["systemPrompt", "tools"]`，加 `pluginPackages` 之类的依赖会让 Cordis 一直 pending（上游踩过，见 release-notes 1.1.70）。

### 3.4 改侧栏 UI

**只改 `lib/redteam/client.js`**，然后：

```sh
npm run build:client   # 重写 client.js 里 BEGIN/END 标记之间的演练台片段
npm run verify
```

`client.js` 剩余部分是给官方 web client bundle 打的补丁（`scripts/patch-client-dock.mjs`），跟官方客户端结构强耦合：官方大改 UI 时要重跑那个脚本，不是改 `client.js`。

### 3.5 加技能 / 改预设

- 技能：往 `skills/redteam/` 丢 `xxx.md`（当前 22 个）。列出与导入逻辑在 `lib/redteam/skill-availability.js` / `lib/skills.js`。
- 预设：`presets/redteam/preset.yml` + `agent.cordis.yml`；门禁在 `presets/redteam/anchor-gate.mjs`。

### 3.6 改身份指针（已做，留档）

| 文件 | 改动 | 为什么 |
| --- | --- | --- |
| `package.json` `repository/homepage/bugs` | → `37-oss/dsh-purge` | 你的仓库 |
| `package.json` `dsh.install.{tarball,zip,git}` | → `37-oss` | 否则「装插件」还去拉上游包，你的改动瞬间被盖掉 |
| `package.json` `version` | 1.1.71 → **1.1.72**（当前 1.1.73） | 自更新按 semver 比大小，不涨版本不会更新 |
| `lib/update.js` `REPO` | → `37-oss/dsh-purge` | 「更新」按钮拉你自己仓库的 tag |
| `package.json` 新增 `upstream` 字段 | 记上游地址 | 留来源，也方便脚本判断 |
| **未改**：`LICENSE`、`LICENSE-COMMERCIAL.md`、`README` 署名要求、`client.js` 的 `welcome.repo`、`lib/redteam/ui.js:360` | 保留 | 署名要求。`tests/repo.test.mjs` 有断言守着，防止手滑删掉 |

---

## 4. 版本与发版

```sh
# 1) 改版本号两处，必须一致
#    package.json  "version": "1.1.73"
#    release-notes.md 首行  "# 1.1.73"
npm run verify
git switch master && git merge --no-ff dev
git push            # push 触发 .github/workflows/release.yml
```

`release.yml` 现在的行为：

1. gate 改成 `github.repository == '37-oss/dsh-purge'` —— 只有你的仓库会发版，不会去动上游 Releases。
2. 先跑 `npm run verify`（我加的），再走原来的 `node --check` 五连。
3. 版本 tag `v<version>` 没发过就 `gh release create`，附带 `dsh-purge-<version>.zip`（`git archive` 打的源码包）。
4. `release-notes.md` 首行对不上版本会直接 fail —— 这是上游设计的闸，别拆。

装回自己机器：`dsh plugin --profile web add github:37-oss/dsh-purge`（桌面端换 `desktop` profile；固定版本写 `github:37-oss/dsh-purge#v1.1.73`）。

---

## 5. 验证：三档，全都不碰本机 dsh

| 档 | 命令 | 跑在哪 | 管什么 |
| --- | --- | --- | --- |
| 1 语法 + 结构 | `npm run verify`（= `npm run check` + `npm test`） | 本机也行，纯静态/纯函数，不读 `$DSH_HOME`、不调 apply | 语法、exports 路径、bundle 挂载、署名、86 条补丁字段、slot 往返、client.js 标记 |
| 2 隔离容器 | `pwsh docker/verify.ps1` | `node:22-bookworm-slim`，`--network none`，仓库只读挂载 | 入口能否 import、CLI `--status`、**空环境 `--apply` 必须被拒**、`npm pack` 清单 |
| 3 云端 | push 触发 `.github/workflows/ci.yml` | GitHub Actions（ubuntu + node 20/22 + 容器 job） | 每次 push/PR 自动跑，等于替你在干净机器上试一遍 |

**本机永远不要 `--apply`。** 那是唯一会写宿主 `@deepseek-ai/*` 的动作；要真机验证就开一台虚拟机 / 一次性容器装 dsh 再试。日常自用装插件由面板「应用」完成，跟开发验证是两件事。

新增测试直接放 `tests/*.test.mjs`（`node:test`，零依赖）。现在这两个文件里的断言都是「改坏了就红」的类型，不是摆设。

---

## 6. 跟上游同步

```sh
git fetch root master upstream master origin
git log --oneline root/master -10                     # 上游又发了什么
git diff master root/master --stat                     # 自己的 fork 跟真源头差多少
git switch dev
git merge root/master                                  # 或 git rebase root/master
git push origin dev
```

冲突高发区，按这个顺序手工合：

1. `lib/core.js` 的四个补丁数组 —— 上游经常改 `pattern` 去追官方新版；**保留上游新版 pattern，把你的自定义补丁追加在后面**，别整块覆盖。
2. `client.js` —— 生成物。冲突就 `git checkout --theirs client.js` 拿上游，然后 `npm run build:client` 重建你的演练台片段。
3. `lib/asset-table.js` —— 加密随机化，永远冲突。拿上游的解出明文 → 合明文 → `npm run embed-prompt` 重新封。
4. `package.json` —— 上游改 version 会跟你冲突：取上游 version 加一，然后同步 `release-notes.md`。

---

## 7. 官方 harness 升版后补丁失效怎么排查

`package.json` 的 `dshTarget`（当前 `0.2.0-rc.2`）是适配基线。官方发新版后：

1. `dsh-purge --status` 看哪几条 `✗ pending`。pending = 原文对不上，跳过，不会写坏文件。
2. 到宿主 `@deepseek-ai/<包>/` 下打开对应文件，找到那段新原文。
3. 把新原文加进该补丁的 `replacements`（旧值→新值一条），保留旧 pattern 作为升级链。
4. 容器/CI 验完，`dshTarget` 跟着改，写进 `release-notes.md`。

---

## 8. 危险动作清单

| 命令 | 后果 | 允许的地方 |
| --- | --- | --- |
| `node bin/dsh-purge.js --apply` | 备份并改写宿主 `@deepseek-ai/*`、shim | 只在一次性容器/虚拟机 |
| `--revert` / `--uninstall` | 拿 `.dshpurge.bak` 覆盖回去、删插件与注入文件 | 同上 |
| `npm run embed-prompt` | 重写 `lib/asset-table.js`（必须提交） | 随便，本地 |
| `npm run build:client` | 重写 `client.js` 的演练台片段（必须提交） | 随便，本地 |
| `git push origin master` | 触发 Release | 版本号与备注对齐后 |

---

## 9. 日常常用命令

```sh
npm run verify                 # 静态 + 结构测试（最常跑）
node scripts/extract-default-prompt.mjs --force   # 解出提示词明文
npm run embed-prompt           # 明文 → asset-table.js
npm run build:client           # lib/redteam/client.js → client.js
pwsh docker/verify.ps1         # 容器隔离验证（Windows）
node bin/dsh-purge.js --status # 只读自检；容器里跑最安全
```

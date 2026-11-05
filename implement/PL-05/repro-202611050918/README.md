# 进程管控问题 A、B 复现证据（2026-11-05，14.15 + 13.18）

> 给终端（客户端）开发同事。终端同事反馈 A、B 无法重现，本次用**全新名单、全新测试程序**在 14.15 中心 + 13.18 终端重新做了最小复现，A、B（白名单）都**稳定复现**。
> 时间均为北京时间。终端 13.18：aarch64，openEuler 24.03，客户端 `/opt/BDFZ/RAV`（09:32 被重装前的版本）。中心 14.15：后端 `models/BaseDA/Procmanager.php` md5 `2e22b6cf…`（11-04 14:29 版本）。
> 本文不含任何口令；名单 zip 的解压密码是后端常量 `Procmanager::WBLIST_ZIP_PASSWORD`，和系统白名单包相同。

## 一、结论

| 问题 | 结论 | 关键证据 |
|---|---|---|
| **A** 名单发布过一次后改内容再发布，终端不更新 | **复现**。中心 zip 文件名不变、md5 变了；终端 32 秒内收到变化，下载模块发现「本地已有同名文件、md5 不同」直接返回 `status 6`，不重新下载；接着 `policy downlib, parse file failed -->6`。终端 `procwlu.lib` 一直停在旧版本 | `R-3/rss-log-key-lines.txt`、`R-3/terminal-after.txt` |
| **B** 用户白名单已加载但匹配不上 | **复现**。终端 `procwlu.lib` 里就是 `rp-w-in` 的 MD5，审计模式下运行 `rp-w-in` 两次都上报「不在白名单」（`ACTIONREASON=2`），上报的哈希和名单里的完全相同（只差大小写） | `R-2/audit-rows.json`、`R-2/terminal-before.txt` |
| B 黑名单部分 | 本次**没测完**：R-4 开始前 13.18 客户端在 09:32 被删除重装（见第五节）。以 11-04 第一轮 E-9 为准：黑名单已下载加载、内容是 `pl05-black` 的 MD5，运行后等满等待时间仍 0 条日志 | `../202611041327/E-9/terminal-blacklist-trace.txt` |

**问题 B 的可疑原因（推断，请终端确认）**：中心生成的用户名单 json 格式和客户端自己的系统白名单格式不一样（第四节）。`policy.md` 只约定了下发报文，没有约定 zip 里 json 的格式，用户名单格式是后端自己定的。

## 二、复现步骤（任何人可照做）

前提：中心进程管控默认策略为**审计**模式（`auditmode=2`）；测试终端已安装客户端、在线。

1. 终端上造测试程序：`cp /usr/bin/sleep /tmp/pl05/rp-w-in; printf 'xxx' >> /tmp/pl05/rp-w-in`（末尾追加任意字节，让 MD5 唯一），同法造 `rp-w-out`、`rp-a-new`。`md5sum` 记下哈希。
2. 中心「白名单」页新建名单，在名单进程视图「添加进程」录入 `rp-w-in` 的路径和 MD5，**发布**。
3. 分组管理新建一个组（取消继承），在名单页把这个白名单**应用到该组**，再把终端移进这个组。等终端收到（日志出现 `OnMscPolicyChange … type="2"` 和 zip 下载成功，本次 17 秒）。
4. **问题 B**：终端运行 `/tmp/pl05/rp-w-in 2`、`/tmp/pl05/rp-w-out 2`。约 1 分钟后中心「审计日志」页或库表 `RPW_PROCESSAUDITINFO` 里，`rp-w-out` 记「不在白名单」是对的；**`rp-w-in` 也记了「不在白名单」**，这是问题。
5. **问题 A**：在同一个白名单里再添加 `rp-a-new`，**再发布**（不要删名单、不要换名）。等终端收到变化后看 `rss.def.log`：出现 `is exist and md5 is diff`、`文件已存在,md5不同`、`parse file failed -->6`；`pwdata/<名单GUID>_aarch64.zip` 的 md5 和中心不一致，`procwlu.lib` 里的 `version` 还是旧的。

**注意（可能是「无法重现」的原因）**：
- 问题 A 的前提是**终端本地已经有这个名单的旧 zip**。全新安装的客户端第一次下载总能成功，只有「同一个名单第二次发布」才触发。
- `rss.def.log` 写得很快（约 2.5 MB/小时），满 5 MB 轮转、只留一份旧文件，**两三个小时前的日志就没了**，事后去终端找日志会找不到。本次证据里已把各步骤的完整日志段存下来。
- 终端每 5 分钟最多处理一次策略变化，连续操作时要等。

## 三、本次实测数据

测试组 `PL05测试组`（组号 84156037，不继承），只挂默认审计策略（PID 3，`uptimer=70`）和本次名单。

| 程序 | MD5（终端 `md5sum`） | 用途 |
|---|---|---|
| `/tmp/pl05/rp-w-in` | `f076494fa14845f1ef19bf647bed4432` | 白名单里 |
| `/tmp/pl05/rp-w-out` | `96a44b6417ba38666e6c317176342cd4` | 不在任何名单（对照） |
| `/tmp/pl05/rp-a-new` | `31574ea984c3b1949157d3af84100a82` | 问题 A 第二次发布时加入 |
| `/tmp/pl05/rp-b-in` | `0b32eb729c730ccc0f6e3b0a03de1012` | 黑名单里（R-4 未跑成） |
| `/tmp/pl05/rp-b-out` | `27b7b026f67fa81f0f307a13a9a2bcfc` | 对照（R-4 未跑成） |

名单：白名单 `PL05测试-复现白`（PGUID `CDEB6541665CEC24CBAE1622D615135B`）、黑名单 `PL05测试-复现黑`（PGUID `227FDE5750553CB2A45A8440A4EFDF09`）。页面录入的 MD5 存库为小写。

### 3.1 时间线

| 时间 | 事件 | 证据 |
|---|---|---|
| 09:18:49 | 13.18 生成 5 个测试程序 | `R-1/programs-ls.txt` |
| 09:19 | 白名单发布（version `17938415456001`，aarch64 zip md5 `61E13DDC…`），应用到测试组，13.18 移入测试组 | `R-1/white-*.json`、`R-1/redis-pgl-list-item.json` |
| 09:19:38 | 终端收到、下载 zip 成功（md5 `61E13DDC…` 校验通过），`procw monstate … type=1 … what=libtype` | `R-1/rss.def.log.segment.txt` 第 719～733 行 |
| 09:20:07 | 运行 `rp-w-in` → 入库 `ACTIONREASON=2`，`FILEHASH=F076494F…` | `R-2/audit-rows.json` |
| 09:20:09 | 运行 `rp-w-out` → 入库 `ACTIONREASON=2`（对照，正确） | 同上 |
| 09:21:58 | 再次运行 `rp-w-in`（名单加载后约 2 分 20 秒）→ 仍 `ACTIONREASON=2` | 同上 |
| 09:24:03 | 白名单加入 `rp-a-new` 后再发布：同名 zip md5 `61E13DDC…` → `040C0EC0…`，version → `17938418434759`，Redis 名单项已指向新 md5 | `R-3/center-zip-before.json`、`center-zip-after.json`、`redis-pgl-list-item-after.json` |
| 09:24:19 | 终端收到变化：`CheckFile … md5[61E13DDC…]` → `is exist and md5 is diff` → `文件已存在,md5不同 status 6` → `parse file failed -->6` | `R-3/rss-log-key-lines.txt` |
| 09:27:39 | 终端 zip 仍是 `61E13DDC…`，`procwlu.lib` 仍是 version `17938415456001`、只含 `rp-w-in` | `R-3/terminal-after.txt` |
| 09:32 | 13.18 的 `/opt/BDFZ/RAV` 被整个删除（来源 172.16.27.20 的 SSH 会话），09:38 起在拷新安装包 `RAV_CSSCTX-3.0.5.26-20260513.tar.gz`。本次测试随即停止 | `env-change/13.18-client-removed.txt` |

### 3.2 问题 B 的核心对照（摘自证据原文）

终端 `pwdata/procwlu.lib`（09:20 运行前）：

```json
{"__lib":{"name":"CDEB6541665CEC24CBAE1622D615135B","type":1,"level":2,"version":"17938415456001","arch":"aarch64"},"path":[{"package":"","hash":[{"algo":0,"md5":"f076494fa14845f1ef19bf647bed4432"}]}]}
```

终端上报、中心入库的审计日志（`RPW_PROCESSAUDITINFO`：ID、时间、路径、ACTIONREASON、PROCACTION、FILEHASH、ALGO）：

```
14124  09:20:07  /tmp/pl05/rp-w-in   2  0  F076494FA14845F1EF19BF647BED4432  0
14125  09:20:09  /tmp/pl05/rp-w-out  2  0  96A44B6417BA38666E6C317176342CD4  0
14131  09:21:58  /tmp/pl05/rp-w-in   2  0  F076494FA14845F1EF19BF647BED4432  0
```

（`ACTIONREASON` 2 = 不在白名单，`PROCACTION` 0 = 放行。）11-04 第一轮 E-6 白名单里是大写 MD5（`B454E238…`，从进程管理页加入），也同样匹配不上，所以大小写大概率不是原因（那次大写内容当时只用 SSH 看过，未存文件）。

## 四、格式对比：用户名单 vs 系统白名单（问题 B 的疑点）

两者是同一种容器（同名 zip、同一个解压密码、包内一个 `<名字>.json`），但 json 结构不同：

| 项 | 系统白名单（客户端提供，能正常用） | 用户名单（中心后端生成） |
|---|---|---|
| 条目组织 | 顶层**每个程序路径一个键**：`"/bin/setserial": [ … ]` | 顶层一个固定键 `"path"`，值是数组 |
| 哈希字段名 | `lmd5` | `md5` |
| 其他字段 | `algo`、`size`、`package` | `algo`、`package`（放在外层），无 `size` |
| `__lib.level` | 1 | 2 |
| 哈希大小写 | 大写 | 页面录入为小写；进程管理页加入为大写 |

系统白名单原文（`format-compare/系统白名单-PW_8C226623-json前3项.txt`）：

```json
{"__lib":{"name":"PW_8C226623-…","type":1,"level":1,"version":"1.0","arch":"aarch64",…},
 "/bin/setserial":[{"algo":8,"lmd5":"EF0ACE92…","size":68856,"package":"setserial-2.17-53.oe2403sp1.aarch64"},
                   {"algo":0,"lmd5":"4313C0CE24DF24DDBCF0A3047147497D","size":68856,"package":"setserial-…"}], …}
```

用户名单原文（`format-compare/用户名单-复现白-json.txt`）：

```json
{"__lib":{"name":"CDEB6541665CEC24CBAE1622D615135B","type":1,"level":2,"version":"17938418434759","arch":"aarch64"},
 "path":[{"package":"","hash":[{"algo":0,"md5":"f076494fa14845f1ef19bf647bed4432"},{"algo":0,"md5":"31574ea984c3b1949157d3af84100a82"}]}]}
```

如果客户端按系统白名单的格式解析用户名单，会把 `"path"` 当成一个叫 `path` 的程序路径、在里面找不到 `lmd5`，结果就是「加载成功、但什么都匹配不上」——和白名单、黑名单两边的现象都吻合。**这是推断**，没有客户端源码无法证实。

## 五、请终端同事确认的问题

1. 用户名单（`level=2`）zip 里 json 的**约定格式**是什么？是不是要和系统白名单一样「路径为键、`lmd5` 字段」？哈希是否要求大写？不带程序路径（只按哈希）的条目是否支持？
2. 问题 A：名单内容更新后，客户端是否应该在「同名文件 md5 和策略里的不同」时覆盖下载？还是要求中心每次发布换文件名（如带版本号）？两种改法选一种，中心或客户端改。
3. 11-05 09:32 是否是终端同事在 13.18 上重装客户端？新装的客户端如果没有旧 zip，问题 A 第一次不会出现，要按第二节第 5 步「同一名单第二次发布」才能看到。

## 六、证据目录

| 路径 | 内容 |
|---|---|
| `R-1/` | 准备：测试程序（`programs.json`、`programs-ls.txt`）、两个名单的新建 / 录入 / 发布接口返回、中心 6 个 zip md5、zip 解开的 json、Redis 名单项、测试组关联、终端前后快照、完整日志段 `rss.def.log.segment.txt` |
| `R-2/` | 问题 B·白：运行记录、审计日志库行、运行前后终端快照（含 `procwlu.lib`、ptfile 原文、pwdata md5）、完整日志段 |
| `R-3/` | 问题 A：中心 zip 改前 / 改后（md5、json、zip 原件 base64）、Redis 名单项、终端日志关键行和完整日志段、终端快照 |
| `format-compare/` | 系统白名单与用户名单 json 原文对比 |
| `env-change/` | 13.18 客户端被删除、重装包拷入的现场记录 |
| `*/network-posts.json` | 页面发出的全部请求（存证用） |
| `results.jsonl`、`*/segments.json` | 脚本逐段结论。R-1 的两条「进程行」FAIL 是脚本按大写比对、页面存成小写导致的误判，不是问题；R-3 最后一段（等 11 分钟看终端重试）因客户端被删没取到 |

复现脚本：`e2e/specs/50-repro-ab.spec.js`（只走页面写操作，中心只读查库 / Redis）。

## 七、现场保留情况

- 中心 14.15 保留：测试组 `PL05测试组`（84156037，挂白名单 `PL05测试-复现白`）、两个名单（PID 52 白、53 黑）、中心 `ruc/libs/w/u/CDEB6541…_*.zip`、`ruc/libs/b/u/227FDE57…_*.zip`、审计日志库行 ID 14124、14125、14131。
- 13.18 仍登记在测试组，`/tmp/pl05/rp-*` 测试程序还在；**客户端目录已被删除重装，终端侧现场（旧 zip、`procwlu.lib`、日志）已不在**，以本目录存证为准。
- 另：中心库里有 PID 40 `__e2e_审计策略`、41 `__e2e_白名单`（创建人 `e2e`，11-04 17:20 左右写入，不是本项目建的），未动。

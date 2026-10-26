# insights/ 索引(INDEX.md)

> **这份文件是「项目记忆」的入库备份索引。**
>
> Agent 的 memory 目录(本机为 `~/.claude/projects/-Users-nick-Workspace-soc-process-ctrl/memory`,目录名由仓库绝对路径机械推导)是**本机私有、不进 git** 的,
> 换机器、清缓存、误删都会整个丢失。`insights/` 进 git,所以它才是项目记忆的**唯一持久载体**;
> 这份 INDEX.md 让它从"一堆散文件"变成"可检索、可恢复的索引"。
>
> ⚠️ **本文件不会被自动加载进上下文**(与 `MEMORY.md` 不同),所以这里放的是**完整 description**
> (上限 150 字)而不是压缩过的一句话钩子 —— 恢复记忆时信息量优先。

## 一、memory 丢了怎么用它恢复

1. 确认 memory 目录空了或不完整:`ls ~/.claude/projects/-Users-nick-Workspace-soc-process-ctrl/memory/`(路径由生成器按仓库位置推导,换机器重跑即更新)
2. **通读本文件的索引正文**(第四节)。每条 = 一条可复用教训的标题 + 完整摘要 + 它原本对应的 memory 文件名。
3. 按 `↳ memory:` 标注的文件名,逐条重建 memory 事实文件:正文从对应 insight 文件里提炼,
   frontmatter 的 `name` 用 `↳ memory:` 里的 slug,`description` 可直接用本索引里的摘要。
4. 重建 `MEMORY.md` 索引:每条一行 `- [标题](文件名.md) — 钩子`。
   ⚠️ 钩子必须**压缩到 120 字以内** —— MEMORY.md 每次会话全量进上下文,写成长摘要会挤占注意力。
5. 没有 `↳ memory:` 标注的条目见下方说明,按价值自行决定要不要新建 memory 条目。

## 二、同步状态(生成时刻实测,本机日期 2026-10-26)

| 指标 | 数值 |
|---|---|
| insights 文件总数 | **9** |
| 其中 memory 侧**显式点名引用**的 | **9** |
| 未见 memory 显式引用的 | **0** |
| memory 事实文件总数 | **10** |
| 断链(索引→文件、memory→insight) | **0** |

⚠️ **「未见 memory 显式引用」不等于「没沉淀进 memory」**。映射是靠"memory 文件正文里有没有写出
insight 文件名"机械提取的,而写引用这件事本身是可选的 —— 有的 memory 条目内容上确实来自某条
insight,只是没留文件名。**所以这 0 条是"待人工确认"的候选,不是"缺口清单",
不要拿它当返工依据。**

## 三、维护规则

- ⚠️ **本文件是生成物,任何情况下都不要手工往索引正文加条目/改条目** —— 下次重跑就被覆盖,白写。
  正确做法是**重跑生成器**:`python3 .claude/scripts/gen-index.py insights --write`
  (仓库任意位置可跑;退出码非 0 即不通过)。完整流程见 `.claude/skills/update-insights/SKILL.md`。
- **三类改动都必须同回合重跑**,不止"新增 insight"一种:
  1. 新增 insight 文件;
  2. 改已有 insight 的 **frontmatter**(`name` / `description` —— 索引条目正文就取自这两个字段;
     只改 insight 正文不影响本文件,可不跑);
  3. **memory 侧增删事实文件,或在 memory 正文里增删 insight 文件名引用** —— 前者进第二节的
     「memory 事实文件总数」,后者定 `↳ memory:` 映射与关联数;改 `MEMORY.md` 本身不影响本文件。
  这条义务与"insights 和 memory 双向同步"是同一件事的两半。
- `description` 不超过 150 字,超了生成器拒绝写入;条目变少时生成器也拒绝(误删保护),
  确需删除加 `--allow-shrink`。
- `↳ memory:` 这一行的来源是机械提取,**不要手写**。重新生成映射:在 memory 文件正文里写上
  对应的 insight 文件名(全称),然后重跑生成器。
- 说明文字改 `.claude/skills/update-insights/assets/INDEX.head.tmpl`,不改本文件。
- 文件命名规则(时间戳)见 `CLAUDE.md`「时间戳命名规则」,本索引不重复。
- 历史文件一律不追溯改名。

## 四、索引正文

> 按自然月分组、组内按时间升序。`↳ memory:` 表示该条已在 memory 侧被显式引用。

<!-- gen-index: body-start -->

### 2026-10

- **[从其他项目移植治理机制(skill/脚本/CLAUDE.md 规则)的体检要点](insight-20261021-0105-从其他项目移植治理机制的体检要点.md)** \
  移植 skill、脚本和 CLAUDE.md 规则前先用 git check-ignore 确认 .claude/ 没被忽略;grep 清掉旧项目的文档号、环境和目录;只登记本项目真实存在的目录;旧规则和现存文件冲突时新规则只管以后,历史文件不改名 \
  ↳ memory: `governance-migration-checklist`
- **[给领导的设计文档按页面组织,不要做开发文档的压缩版](insight-20261021-0105-给领导的设计文档按页面组织.md)** \
  给领导看的概要设计要以 demo 页面为脉络、配截图、写成单文件 html,不写代码位置和协议细节;把开发设计文档压短的同视角版本领导会否掉。开发文档 01 不为领导改,00 一次性交付不维护 \
  ↳ memory: `single-design-doc`
- **[在 101 共享开发环境上联调、上传和实测的坑](insight-20261022-0447-101共享环境联调的坑.md)** \
  101 是同事共用环境:不带 RSTOCKEN 的 POST 会销毁会话;同事随时改接口参数和默认值、还会用部署把我们上传的公共文件覆盖回旧版。确认会话只走 RsCore.ajax,mock 调真接口要显式写死取全量参数,收尾前重核 101 指纹,判「环境问题」前先定位拦截代码 \
  ↳ memory: `env101-shared-pitfalls`
- **[「今天」按哪个时区算:mock、页面、后端必须同一口径](insight-20261022-0447-今天按哪个时区.md)** \
  中心后端按 Asia/Shanghai 算「本周 / 本月」,前端在美东测试时本机日期常比北京晚一天。凡算「今天」的地方(mock、日期选择器上限)都用 UTC+8 + getUTC*,每次用时现算;验收要在两边日期不同的时段注入时刻;改了口径后按「哪些代码用到它」逐个 grep \
  ↳ memory: `today-timezone-beijing`
- **[计划实施循环里留痕与检查器的教训](insight-20261022-0447-实施循环留痕与检查器教训.md)** \
  implement-plan 长循环里,主 Agent 自己的留痕(状态页、覆盖表、裁决依据)是返工主因。状态页同主题多处要一起改,文件指纹也是事实;检查器要挂到每次都跑的检查里;连带要求按调用方机械列举进覆盖表;证据放持久目录;旧测试壳会随后续改动过时 \
  ↳ memory: `implement-plan-trail-lessons`
- **[回归用例与全量验收的证据口径](insight-20261022-1011-回归用例与全量验收的证据口径.md)** \
  「不受影响 / 与改动前一致」类回归是前后比较，派活别改写成「等于某份静态原文」；前值要在进被测页之前、走同一入口真打开采集。全量验收复用早先某条用例结果时，要写明时间先后和文件、库指纹未变的证据 \
  ↳ memory: `regression-before-after-evidence`
- **[照搬现有页面弹窗要带上它的外壳类名，别手抄样式](insight-20261023-0443-照搬现有页面弹窗要带外壳类名.md)** \
  搬策略中心等现有弹窗到名单页：外套同样的外壳类名、只补绑在编号上的规则并抵消外壳宽度边距；弹窗在 .c-page-content 里会吃公共表格样式要压回；照抄表格配置先核对依赖插件（如 useIcheck）；上 101 两边逐项量样式。 \
  ↳ memory: `copy-modal-wrapper-class`
- **[对齐策略中心样式要量浏览器实际值，别照代码字面](insight-20261025-2148-对齐策略中心样式要量实际值.md)** \
  名单页对齐策略中心时踩 3 个坑：body 字体名整串加引号、实际退回默认字体；openLine.js 只写颜色的 border-bottom 简写实际是去掉边线；alertBoxDrag 会吞点击，类加整个标题栏会让 × 失效，要加在 h3 上。照抄前先到 101 量实际值。 \
  ↳ memory: `align-strategy-style-measure`
- **[本地、svn、101 三方是否一致要分别核指纹](insight-20261026-0213-本地svn与101三方指纹分开核.md)** \
  用户手动提交 svn 前可能先改文件；svn st 干净只说明本地 = svn，不说明 = 101。写「svn 与 101 一致」前，本地和 101 两边都要实算指纹，不一致再去注释比代码，弄清改的是注释还是代码。 \
  ↳ memory: `three-way-fingerprint`

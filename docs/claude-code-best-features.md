# Claude Code Best — 相比 opencode 的独有功能

[Claude Code Best](https://github.com/claude-code-best/claude-code) 是对 Anthropic Claude Code 的反编译增强版。以下列出 opencode 不具备但 CCB 已实现的功能，可作为后续 fork 的参考。

## 一、Dynamic Workflow / 自主工作流编排

用户通过 `/ultracode` 或 `.claude/workflows/` 下的 JS 脚本定义多 agent 编排。引擎在受限沙箱内确定性执行，支持 agent/parallel/pipeline/phase 等原语，journal 可重放，token budget 可配置。

- **Double panel 监控面板**: `/workflows` 打开实时进度面板，按 phase 分组可视化 agent 执行状态
- **核心文件**: `packages/workflow-engine/`, `src/workflow/`
- **opencode 类比**: 无。opencode 只有单 agent 循环，没有多 agent 编排

## 二、Goal / 目标驱动持续执行

`/goal <objective>` 设定目标后，代理跨轮持续驱动直至完成。包含 token budget、completion audit (6 步验证)、blocked audit (3 次尝试豁免)、auto-pause on network interruption.

- **核心文件**: `src/services/goal/`, `src/commands/goal/`
- **opencode 类比**: 无。opencode 无目标驱动机制，每轮需用户主动 continue

## 三、Token Budget / 预算自动持续模式

用户输入 `+500k` 或 `spend 2M tokens`，代理自动持续工作直到达到预算的 90% 或检测到收益递减（连续 3 轮 <500 tokens/turn）。底部 spinner 显示实时进度和 ETA。

- **核心文件**: `src/utils/tokenBudget.ts`, `src/query/tokenBudget.ts`
- **opencode 类比**: 无

## 四、Session Memory Compact / 零 API 成本压缩

每次 turn 后 fork 子代理提取记忆写到文件。压缩时优先读文件当预构建摘要，跳过 API 调用。仅在记忆不充分时才回退到传统 compact。

- **核心文件**: `src/services/compact/sessionMemoryCompact.ts`
- **opencode 类比**: 纯 API compact，每 10-20K token 消耗

## 五、多层记忆管道

4 阶段生命周期：Turn-end 提取 → 会话开始时回传 → 5+ 会话后 Auto Dream 合并 → 修剪到 <200 行/25KB。

- 记忆类型: user / feedback / project / reference
- 只存无法从代码推导的信息
- Sonnet 侧查询智能召回（≤5 条最相关的记忆）
- **核心文件**: `src/memdir/`, `src/services/extractMemories/`, `src/services/autoDream/`
- **opencode 类比**: 仅有 AGENTS.md（手动），无自动提取/整合/修剪

## 六、Fork Subagent / 缓存共享子代理

子代理继承父的 frozen rendered system prompt + history，并行 N 个共用同一缓存前缀。使用 identical placeholder tool results 最大化 cache byte identity。

- **核心文件**: `packages/builtin-tools/src/tools/AgentTool/forkSubagent.ts`
- **opencode 类比**: 有 Task tool 但无缓存共享机制

## 七、LAN Pipes / 跨机器代理蜂群

UDP multicast beacon (224.0.71.67:7101) 自动发现局域网内的 Claude Code 实例。零配置，TTL=1 限制子网内。同机用 UDS/named pipes，跨机用 TCP/NDJSON。

- **核心文件**: `src/utils/lanBeacon.ts`, `src/utils/pipeTransport.ts`, `src/utils/pipeRegistry.ts`
- **opencode 类比**: 无

## 八、Prompt Cache 稳定性架构

所有 toggle 选项放 body params 而非 system prompt。工具列表确定排序。动态 section 标记 cacheBreak。预算 prompt 无条件缓存（无切换 cache miss）。

- **核心文件**: `src/constants/systemPromptSections.ts`, `src/tools.ts`
- **opencode 类比**: 无。opencode 的 system prompt 每轮变化明显（目录/日期注入），cache 效率低

## 九、Auto Dream / 自动记忆整理

5+ 会话 + 24 小时后自动触发 forked agent 整理记忆目录。4 阶段：Orient→Gather→Consolidate→Prune。MEMORY.md <200 行/25KB。

- **核心文件**: `src/services/autoDream/`
- **opencode 类比**: 无

## 十、其他值得注意的功能

| 功能 | 说明 |
|---|---|
| **Artifacts** | 模型上传 HTML/报告到公开 URL，7d/30d 自动过期 |
| **KAIROS 常驻助手** | CLI 作为持久化 daemon 跨终端重启存活 |
| **Poor Mode** | 跳过记忆提取和提示建议，大幅度减少并发 API 请求 |
| **Voice Mode** | 语音输入 |
| **Computer Use / Chrome Use** | 屏幕截图、键鼠控制、浏览器自动化 |
| **Langfuse 监控** | 企业级 agent 循环可观测性 |
| **Channels 通知** | MCP 推送外部消息（飞书/Slack/Discord/微信）进会话 |
| **ACP 协议** | 连接 Zed/Cursor 等 IDE 作为 agent，会话 resume + 权限桥接 |
| **teach-me 学习** | Socrates 式自适应代码库教学 |
| **Coordinator Mode** | 多 agent 编排，conductor 仅用 Agent/SendMessage/TaskStop 工具 |
| **Away Summary** | 终端离开检测 → 自动生成摘要 |
| **JSONL Transcript 持久化** | append-only JSONL，分支/拓扑全重建 |
| **自定义 Agent (Markdown)** | 从 markdown 定义 agent，三种加载源，工具过滤 |

## 按实现难度排序（供 fork 参考）

| 排名 | 功能 | 难度 | 理由 |
|---|---|---|---|
| 1 | Token Budget | 低 | 纯状态跟踪 + 循环逻辑，少量文件改动 |
| 2 | Session Memory Compact | 中 | 需 extractMemories agent + compact 路径集成 |
| 3 | Fork Subagent 缓存共享 | 中 | 需渲染 prompt 冻结 + agent spawn 重构 |
| 4 | 多层记忆管道 | 高 | 多 agent 架构 + 文件管理 + 门控系统 |
| 5 | Dynamic Workflow | 高 | 完整引擎 + 后端适配器 + 面板 UI |
| 6 | Goal 目标驱动 | 高 | 状态机 + 审计系统 + budget 集成 + pause/resume |
| 7 | LAN Pipes | 高 | UDP 广播 + TCP 协议 + 多平台终端适配 |
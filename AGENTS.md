# WeAreGeng Agent 指南

学术打假搜索平台（Vue + Tauri 桌面客户端）。启动方式：

```bash
git submodule update --init --depth 1 vendor/mastra   # 首次 clone 后若未 --recursive
npm install
npm run setup:mastra   # vendor/mastra-packages/dist（postinstall 自动执行）
npm run setup:node     # 下载 Node 到 vendor/node/（Tauri Agent 用）
npm run tauri:dev    # 桌面客户端（Agent 走 Node 子进程 + Mastra）
```

## Node Agent 打包

Tauri 发布包内置 Node + Mastra Agent（无需用户安装 Node）：

```bash
npm run build:tauri-agent   # setup:node + build:agent + prepare:agent-resources
npm run tauri:build
```

- `vendor/mastra/` — Mastra 上游（**git submodule**，见 `.gitmodules`）
- `vendor/node/{target-triple}/` — 官方 Node 二进制（`.gitignore`，CI/本地下载）
- `dist/agent-runner.mjs` — esbuild 打包的 Agent worker
- `src-tauri/resources/agent-runtime/` — Tauri 打包资源（Node + runner + data/experts）

GitHub Actions：`.github/workflows/ci.yml`（测试）、`.github/workflows/release.yml`（打 tag 多平台打包）。

## 数据

```
data/
├── meta/           # universities.json, fields.json, journals.json
├── experts/
│   ├── by-honor/   # 按荣誉汇总（fetch-talents）
│   └── by-org/     # 按单位拆分（split-experts）
└── crawl/          # manifest.json、探测到的 URL 等
```

- `npm run fetch-talents` — 抓取并写入 `by-honor/`、`crawl/`
- `npm run split-experts` — 从 `by-honor/` 生成 `by-org/`

## 客户端代理

Tauri Rust 后端提供 HTTP 代理与 Agent 基础设施，前端通过 `src/api/proxy.ts` 经 `invoke('http_proxy')` 发起请求。

- 配置存储：`get_config` / `update_config`（应用配置目录 `config.json`）
- LLM 测试：`test_llm`
- LLM 对话（含 Tool Calling）：`llm_chat`
- 文件系统：`fs_read_text`、`fs_list_dir`、`fs_pick_file`
- PDF 解析：`pdf_extract_text`
- 分析持久化：`db_save_analysis`、`db_list_analyses`

## Agent 包

- `packages/agent/` — 论文搜索（OpenAlex + Semantic Scholar）、AI 分析、Tool 定义
- `src/services/academic-agent.ts` — 经 Tauri `agent_run` 调用 Node 子进程 Agent
- `/agent` 路由 — Agent 对话页

## 工作流

1. 用户选择筛选条件 → 浏览高校/专家
2. 在设置页配置 LLM API Key 并测试连接
3. 论文搜索与 AI 分析（需配置 LLM API Key）
4. Agent 多步对话（侧边栏「Agent」；支持联网搜索、引用链、会话持久化）
5. **学者深度调查**（侧边栏「调查」）：姓名+学校 → 多步检索、论文分析、引用/开源核查
6. MCP Server：`npm run mcp:server`（见设置页 MCP 分区；供 Cursor 等外部客户端接入）

## Agent 架构方案

复杂 Agent 能力（论文搜索、AI 分析、本地 PDF、记忆持久化、MCP 扩展）的完整技术方案见：

- [`docs/AGENT-ARCHITECTURE.md`](docs/AGENT-ARCHITECTURE.md)
- [`docs/MCP.md`](docs/MCP.md) — MCP Server 配置与启动

核心选型：Mastra 本地克隆 + OpenAlex（主）/ Semantic Scholar（辅）+ Tauri PDF 解析 + MCP 协议。

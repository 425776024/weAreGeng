# WeAreGeng MCP Server

对外暴露论文搜索、引用链、AI 分析、专家检索等 Tool，供 Cursor / Claude Desktop 调用。

## 启动

```bash
export WEAREGENG_LLM_API_KEY=sk-...
npm run mcp:server
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `WEAREGENG_LLM_API_KEY` | analyze_paper 需要 | OpenAI-compatible API Key |
| `WEAREGENG_LLM_BASE_URL` | 否 | 默认 `https://api.openai.com/v1` |
| `WEAREGENG_LLM_MODEL` | 否 | 默认 `gpt-4o-mini` |
| `WEAREGENG_S2_API_KEY` | 否 | Semantic Scholar API Key |
| `WEAREGENG_MCP_S2_ENABLED` | 否 | 设为 `1` 时 MCP Server 运行时合并 semantic-scholar-mcp 外部 Tool |
| `WEAREGENG_DATA_DIR` | 否 | 专家库目录，默认 `./data/experts` |
| `WEAREGENG_DB_PATH` | 否 | 桌面 SQLite 路径（`we-are-geng.db`），启用 `save_analysis` / `recall_analyses` / `recall_memory` |
| `WEAREGENG_MEMORY_DB_PATH` | 否 | Mastra Memory 库路径（`mastra-memory.db`），启用语义记忆 |
| `WEAREGENG_PROJECT_ROOT` | 否 | 项目根目录，默认 `process.cwd()` |

## Cursor 配置

在项目或用户 `mcp.json` 中添加：

```json
{
  "mcpServers": {
    "we-are-geng": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/path/to/weAreGeng",
      "env": {
        "WEAREGENG_LLM_API_KEY": "your-api-key"
      }
    }
  }
}
```

## 可用 Tool

- `search_papers` — OpenAlex + Semantic Scholar 论文搜索
- `get_paper` — 按 ID/DOI 获取论文详情
- `get_citations` — 引用链（citing / references）
- `analyze_paper` — AI 学术诚信分析
- `search_experts` — 本地专家库检索
- `recall_analyses` — 历史 AI 分析记录
- `recall_memory` — 历史 Agent 对话记忆（桌面端 SQLite）
- `web_search` — 联网搜索
- `read_local_pdf` / `read_local_file` — 本地文件（MCP 模式直连 fs + pdf-parse）
- `save_analysis` — 持久化分析（需 `WEAREGENG_DB_PATH`）

## MCP Server 实现

`npm run mcp:server` 使用 `@mastra/mcp` 的 `MCPServer`，Tool 定义与 Agent 共用 `packages/agent/tools/registry.ts`（单一来源）。

## MCP Client（接入外部 Tool）

WeAreGeng Agent 通过 `@mastra/mcp` 的 `MCPClient` 可连接 [semantic-scholar-mcp](https://github.com/yogsoth-ai/semantic-scholar-mcp)：

**桌面客户端**：在设置 → MCP 中勾选「启用 Semantic Scholar MCP Client」，保存后 Node Agent 子进程会自动合并外部 Tool。

**CLI / 开发**：

```bash
export WEAREGENG_MCP_S2_ENABLED=1
export WEAREGENG_S2_API_KEY=optional-s2-key
export WEAREGENG_LLM_API_KEY=sk-...
npm run mcp:server
```

外部 Tool 以 `semantic-scholar_*` 前缀合并进 Mastra Agent Tool Registry。stdio MCP 需在 Node.js 环境运行；桌面客户端对话页使用内置 HTTP 适配器。

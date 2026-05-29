---
name: we-are-geng
description: WeAreGeng 学术打假搜索平台 — 中国 Top100 高校论文检索、多源公开数据库搜索、LLM 虚假内容分析。Use when running we-are-geng CLI, searching academic papers from Chinese universities, analyzing papers for fraud/fabrication, or configuring LLM agent for paper analysis.
---

# WeAreGeng 学术打假搜索

中国高校论文学术打假搜索与分析平台。支持 Top 100 大学（985/211 标记）、多源公开论文检索、AI 虚假内容检测。

## 快速启动

```bash
npm install
npm run build
npm run dev
```

默认地址: `http://localhost:3003`

## 独立前端开发

```bash
npm run dev --workspace=@we-are-geng/cli   # API
npm run web:dev                             # Vue HMR
```

## Agent 工作流

1. 首页选择大学 + 领域 + 期刊 + 时间
2. POST `/api/search` 获取论文
3. POST `/api/analyze/batch` 分析选中论文
4. 分析页：左侧原文，右侧异常标记
5. 先在设置页配置 LLM API Key

## API

- `GET /api/meta/universities` — Top 100 大学
- `POST /api/search` — 搜索论文
- `POST /api/analyze` — 分析单篇
- `POST /api/analyze/batch` — 批量分析
- `PUT /api/config` — 配置 LLM

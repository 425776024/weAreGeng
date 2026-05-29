# 本地数据目录

```
data/
├── meta/                    # 静态配置（手工维护）
│   ├── universities.json    # Top 100 高校
│   ├── fields.json          # 学科领域
│   └── journals.json        # 期刊
├── experts/                 # 专家数据（脚本生成）
│   ├── by-honor/            # 按荣誉类型汇总
│   │   ├── yuanshi-cas.json
│   │   ├── yuanshi-cae.json
│   │   ├── jieqing.json
│   │   ├── youqing.json
│   │   └── qianqing.json
│   └── by-org/              # 按单位拆分（split-experts 生成）
│       ├── _index.json
│       └── {单位-slug}.json
└── crawl/                   # 抓取元数据（fetch-talents 生成）
    ├── manifest.json        # 来源、人数、抓取时间
    ├── discovered-university-pages.json
    └── university-talents.json  # 高校页原始合并（审计用，前端不加载）
```

路径常量见 `scripts/lib/data-paths.mjs`。

## 更新数据

```bash
npm run fetch-talents    # 抓取 → by-honor + crawl/manifest.json
npm run split-experts    # 仅重新拆分 by-org（fetch 末尾会自动调用）
```

## 专家 JSON 字段

```json
{
  "id": "杰青-张三",
  "name": "张三",
  "title": "研究方向",
  "university": "清华大学",
  "field": "生命科学部",
  "tags": ["杰青", "2019"],
  "honor": "杰青",
  "year": 2019,
  "source": "https://www.nsfc.gov.cn/...",
  "sourceOrg": "国家自然科学基金委员会"
}
```

## 数据来源

| 文件 | 来源 |
|------|------|
| `by-honor/yuanshi-cas.json` | [中科院学部](https://casad.cas.cn/ysxx2022/ysmd/qtys/) |
| `by-honor/yuanshi-cae.json` | [中国工程院](https://www.cae.cn/cae/html/main/col48/column_48_1.html) |
| `by-honor/jieqing.json` | 国自然委、ncku1897 维基、高校公示页等 |
| `by-honor/youqing.json` | 同上 |
| `by-honor/qianqing.json` | 暂无全国完整 HTML 名单 |
| `crawl/manifest.json` | 抓取统计与来源 URL |

修改数据后重新运行 `npm run fetch-talents`，或重启开发服务器以刷新 Vite 缓存。

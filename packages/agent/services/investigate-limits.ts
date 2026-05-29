/** 深度调查配额：论文可多，外网请求串行 + 按域名 pacing */
export const INVESTIGATE_LIMITS = {
  /** 默认保留论文数 */
  maxPapers: 12,
  /** 单次调查论文数上限（可通过参数下调，不超过此值） */
  maxPapersCap: 20,
  maxNameVariants: 4,
  /** 论文检索使用的姓名变体次数（逐个串行请求） */
  maxPaperSearchVariants: 3,
  maxAuthorCandidates: 3,
  maxPapersToAnalyze: 5,
  maxReferenceChecks: 3,
  maxOpensourceChecks: 5,
  maxWebQueries: 2,
  /** 单次 OpenAlex/S2 搜索拉取条数 */
  paperSearchApiLimit: 15,
  citationFetchLimit: 8,
  /** 变体检索之间的额外间隔（叠加 api-pacing 按域名限流） */
  variantGapMs: 800,
} as const

/** 调查优先 OpenAlex；仅无结果时再尝试 Semantic Scholar */
export const INVESTIGATE_SOURCES_OPENALEX_ONLY = {
  openAlex: true,
  semanticScholar: false,
  crossref: false,
  arxiv: false,
  pubmed: false,
} as const

export const INVESTIGATE_SOURCES_S2_FALLBACK = {
  openAlex: false,
  semanticScholar: true,
  crossref: false,
  arxiv: false,
  pubmed: false,
} as const

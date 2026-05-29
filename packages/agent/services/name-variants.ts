import type { LlmChatFn } from './analyzer'

const LATIN_NAME = /^[a-zA-Z\s.-]+$/

/** 简单判断是否为中文姓名 */
export function isChineseName(name: string): boolean {
  return /[\u4e00-\u9fff]/.test(name)
}

function unique(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    const t = n.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

/** 拉丁姓名：生成 "Given Family" / "Family Given" 变体 */
function latinVariants(name: string): string[] {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return [name.trim()]
  const reversed = [...parts].reverse().join(' ')
  return unique([name.trim(), reversed, parts.join(' ')])
}

/**
 * 扩展检索用姓名变体（中文 + 英文 + 拼音风格）。
 * 优先 LLM；否则启发式 + 原姓名。
 */
export async function expandNameVariants(
  name: string,
  university?: string,
  llmChat?: LlmChatFn,
  maxVariants = 6,
): Promise<string[]> {
  const base = name.trim()
  if (!base) return []

  const variants: string[] = [base]

  if (LATIN_NAME.test(base)) {
    return unique([...variants, ...latinVariants(base)]).slice(0, Math.max(1, maxVariants))
  }

  if (llmChat && isChineseName(base)) {
    try {
      const res = await llmChat({
        messages: [
          {
            role: 'system',
            content:
              '你是姓名转写助手。输出 JSON 数组，包含中文姓名对应的英文/拼音检索变体（如 Zhang San, San Zhang, 张三）。只输出 JSON 数组，不要解释。',
          },
          {
            role: 'user',
            content: `姓名：${base}${university ? `\n单位：${university}` : ''}\n请给出 2-3 个用于学术论文检索的姓名变体。`,
          },
        ],
        jsonMode: false,
        maxTokens: 256,
      })
      const cleaned = res.content.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned) as unknown
      if (Array.isArray(parsed)) {
        for (const v of parsed) {
          if (typeof v === 'string') variants.push(v)
        }
      }
    } catch {
      // LLM 失败时使用启发式
    }
  }

  // 中文无空格时，尝试插入空格（常见双字名）
  if (isChineseName(base) && base.length >= 2 && base.length <= 4) {
    if (base.length === 2) {
      variants.push(`${base[0]} ${base[1]}`)
    } else if (base.length === 3) {
      variants.push(`${base[0]}${base.slice(1)}`, `${base.slice(0, 2)} ${base[2]}`)
    } else if (base.length === 4) {
      variants.push(`${base.slice(0, 2)} ${base.slice(2)}`)
    }
  }

  return unique(variants).slice(0, Math.max(1, maxVariants))
}

/** 构建联网搜索 query 列表 */
export function buildWebSearchQueries(
  name: string,
  university: string | undefined,
  variants: string[],
  maxQueries = 8,
): string[] {
  const queries: string[] = []
  const schools = university ? [university] : ['']
  const names = unique([name, ...variants]).slice(0, 2)

  for (const n of names) {
    for (const school of schools) {
      queries.push(school ? `${n} ${school} 论文` : `${n} 学术论文`)
      if (maxQueries > 1) {
        queries.push(school ? `${n} ${school} 学术争议` : `${n} academic controversy`)
      }
    }
  }
  return unique(queries).slice(0, maxQueries)
}

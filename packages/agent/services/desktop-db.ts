import { createClient, type Client } from '@libsql/client'

let client: Client | null = null
let clientPath: string | null = null

export function openDesktopDb(dbPath: string): Client {
  if (client && clientPath === dbPath) return client
  client?.close()
  clientPath = dbPath
  client = createClient({ url: dbPath.startsWith('file:') ? dbPath : `file:${dbPath}` })
  return client
}

export function resolveDesktopDbPath(): string | undefined {
  return process.env.WEAREGENG_DB_PATH || undefined
}

export async function saveAnalysisRow(
  db: Client,
  row: {
    id: string
    paperId: string
    paperJson: string
    summary: string
    score: number
    flagsJson: string
    analyzedAt: string
    fullText?: string
  },
) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO analyses
      (id, paper_id, paper_json, summary, score, flags_json, full_text, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      row.id,
      row.paperId,
      row.paperJson,
      row.summary,
      row.score,
      row.flagsJson,
      row.fullText ?? null,
      row.analyzedAt,
    ],
  })
}

export async function listAnalysisRows(db: Client, limit = 10) {
  const res = await db.execute({
    sql: `SELECT id, paper_id, paper_json, summary, score, flags_json, full_text, analyzed_at
      FROM analyses ORDER BY analyzed_at DESC LIMIT ?`,
    args: [limit],
  })
  return res.rows.map((r) => ({
    id: String(r.id),
    paperId: String(r.paper_id),
    paperJson: String(r.paper_json),
    summary: r.summary != null ? String(r.summary) : undefined,
    score: r.score != null ? Number(r.score) : undefined,
    flagsJson: r.flags_json != null ? String(r.flags_json) : undefined,
    fullText: r.full_text != null ? String(r.full_text) : undefined,
    analyzedAt: String(r.analyzed_at),
  }))
}

export async function searchMessageRows(
  db: Client,
  query: string,
  sessionId?: string,
  limit = 10,
) {
  const pattern = `%${query.replace(/%/g, '').replace(/_/g, '')}%`
  const sql = sessionId
    ? `SELECT m.session_id, s.title, m.role, m.content, m.created_at
       FROM messages m LEFT JOIN sessions s ON s.id = m.session_id
       WHERE m.session_id = ? AND m.content LIKE ? ORDER BY m.created_at DESC LIMIT ?`
    : `SELECT m.session_id, s.title, m.role, m.content, m.created_at
       FROM messages m LEFT JOIN sessions s ON s.id = m.session_id
       WHERE m.content LIKE ? ORDER BY m.created_at DESC LIMIT ?`

  const args = sessionId ? [sessionId, pattern, limit] : [pattern, limit]
  const res = await db.execute({ sql, args })
  return res.rows.map((r) => ({
    sessionId: String(r.session_id),
    sessionTitle: r.title != null ? String(r.title) : undefined,
    role: String(r.role),
    content: String(r.content ?? '').slice(0, 500),
    createdAt: String(r.created_at),
  }))
}

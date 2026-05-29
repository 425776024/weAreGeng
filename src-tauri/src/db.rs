use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())
        .map(|p| p.join("we-are-geng.db"))
}

pub fn memory_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let path = db_path(app)?;
    Ok(path
        .parent()
        .map(|p| p.join("mastra-memory.db"))
        .unwrap_or_else(|| PathBuf::from("mastra-memory.db")))
}

pub fn init_db(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS analyses (
            id          TEXT PRIMARY KEY,
            paper_id    TEXT NOT NULL,
            paper_json  TEXT NOT NULL,
            summary     TEXT,
            score       REAL,
            flags_json  TEXT,
            full_text   TEXT,
            analyzed_at TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_analyses_paper ON analyses(paper_id);

        CREATE TABLE IF NOT EXISTS sessions (
            id          TEXT PRIMARY KEY,
            title       TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS messages (
            id          TEXT PRIMARY KEY,
            session_id  TEXT NOT NULL,
            role        TEXT NOT NULL,
            content     TEXT,
            tool_calls  TEXT,
            tool_results TEXT,
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

        CREATE TABLE IF NOT EXISTS bookmarks (
            id          TEXT PRIMARY KEY,
            paper_id    TEXT,
            paper_json  TEXT,
            note        TEXT,
            created_at  TEXT DEFAULT (datetime('now'))
        );
        ",
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAnalysis {
    pub id: String,
    pub paper_id: String,
    pub paper_json: String,
    pub summary: Option<String>,
    pub score: Option<f64>,
    pub flags_json: Option<String>,
    pub full_text: Option<String>,
    pub analyzed_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAnalysisArgs {
    pub id: String,
    pub paper_id: String,
    pub paper_json: String,
    pub summary: Option<String>,
    pub score: Option<f64>,
    pub flags_json: Option<String>,
    pub full_text: Option<String>,
    pub analyzed_at: String,
}

#[tauri::command]
pub fn db_save_analysis(
    state: State<'_, DbState>,
    args: SaveAnalysisArgs,
) -> Result<(), String> {
    save_analysis_record(&state, &args)
}

pub fn save_analysis_record(state: &State<'_, DbState>, args: &SaveAnalysisArgs) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO analyses
         (id, paper_id, paper_json, summary, score, flags_json, full_text, analyzed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            args.id,
            args.paper_id,
            args.paper_json,
            args.summary,
            args.score,
            args.flags_json,
            args.full_text,
            args.analyzed_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_list_analyses(state: State<'_, DbState>, limit: Option<u32>) -> Result<Vec<StoredAnalysis>, String> {
    list_analyses(&state, limit.unwrap_or(100).min(500))
}

pub fn list_analyses(state: &State<'_, DbState>, limit: u32) -> Result<Vec<StoredAnalysis>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.min(500);
    let mut stmt = conn
        .prepare(
            "SELECT id, paper_id, paper_json, summary, score, flags_json, full_text, analyzed_at
             FROM analyses ORDER BY analyzed_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(StoredAnalysis {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                paper_json: row.get(2)?,
                summary: row.get(3)?,
                score: row.get(4)?,
                flags_json: row.get(5)?,
                full_text: row.get(6)?,
                analyzed_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSession {
    pub id: String,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<String>,
    pub tool_results: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionArgs {
    pub id: String,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveMessageArgs {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<String>,
    pub tool_results: Option<String>,
}

#[tauri::command]
pub fn db_create_session(state: State<'_, DbState>, args: CreateSessionArgs) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO sessions (id, title, updated_at) VALUES (?1, ?2, datetime('now'))",
        params![args.id, args.title],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_list_sessions(state: State<'_, DbState>, limit: Option<u32>) -> Result<Vec<StoredSession>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50).min(200);
    let mut stmt = conn
        .prepare("SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(StoredSession {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_save_message(state: State<'_, DbState>, args: SaveMessageArgs) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO messages (id, session_id, role, content, tool_calls, tool_results)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            args.id,
            args.session_id,
            args.role,
            args.content,
            args.tool_calls,
            args.tool_results,
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?1",
        params![args.session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_list_messages(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<StoredMessage>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, content, tool_calls, tool_results, created_at
             FROM messages WHERE session_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(StoredMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                tool_calls: row.get(4)?,
                tool_results: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySearchHit {
    pub session_id: String,
    pub session_title: Option<String>,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMemoryArgs {
    pub query: String,
    pub session_id: Option<String>,
    pub limit: Option<u32>,
}

pub fn search_memory(
    state: &State<'_, DbState>,
    args: SearchMemoryArgs,
) -> Result<Vec<MemorySearchHit>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = args.limit.unwrap_or(10).min(50);
    let pattern = format!("%{}%", args.query.replace('%', "").replace('_', ""));

    let mut hits: Vec<MemorySearchHit> = if let Some(session_id) = args.session_id {
        let mut stmt = conn
            .prepare(
                "SELECT m.session_id, s.title, m.role, m.content, m.created_at
                 FROM messages m
                 LEFT JOIN sessions s ON s.id = m.session_id
                 WHERE m.session_id = ?1 AND m.content LIKE ?2
                 ORDER BY m.created_at DESC LIMIT ?3",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![session_id, pattern, limit], |row| {
                Ok(MemorySearchHit {
                    session_id: row.get(0)?,
                    session_title: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT m.session_id, s.title, m.role, m.content, m.created_at
                 FROM messages m
                 LEFT JOIN sessions s ON s.id = m.session_id
                 WHERE m.content LIKE ?1
                 ORDER BY m.created_at DESC LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![pattern, limit], |row| {
                Ok(MemorySearchHit {
                    session_id: row.get(0)?,
                    session_title: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    for hit in &mut hits {
        if hit.content.len() > 500 {
            hit.content = format!("{}…", &hit.content[..500]);
        }
    }

    Ok(hits)
}

#[tauri::command]
pub fn db_search_memory(
    state: State<'_, DbState>,
    args: SearchMemoryArgs,
) -> Result<Vec<MemorySearchHit>, String> {
    search_memory(&state, args)
}

#[tauri::command]
pub fn db_delete_session(state: State<'_, DbState>, session_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM messages WHERE session_id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBookmark {
    pub id: String,
    pub paper_id: Option<String>,
    pub paper_json: String,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBookmarkArgs {
    pub id: String,
    pub paper_id: Option<String>,
    pub paper_json: String,
    pub note: Option<String>,
}

#[tauri::command]
pub fn db_save_bookmark(state: State<'_, DbState>, args: SaveBookmarkArgs) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO bookmarks (id, paper_id, paper_json, note) VALUES (?1, ?2, ?3, ?4)",
        params![args.id, args.paper_id, args.paper_json, args.note],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_list_bookmarks(state: State<'_, DbState>, limit: Option<u32>) -> Result<Vec<StoredBookmark>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100).min(500);
    let mut stmt = conn
        .prepare(
            "SELECT id, paper_id, paper_json, note, created_at FROM bookmarks ORDER BY created_at DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(StoredBookmark {
                id: row.get(0)?,
                paper_id: row.get(1)?,
                paper_json: row.get(2)?,
                note: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn db_delete_bookmark(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM bookmarks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

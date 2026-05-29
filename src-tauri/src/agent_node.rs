use crate::config::{load_config, AppConfig, SourcesConfig};
use crate::db::{list_analyses, memory_db_path, save_analysis_record, search_memory, DbState, SaveAnalysisArgs, SearchMemoryArgs, StoredAnalysis};
use crate::pdf::PdfExtractResult;
use crate::web_search::{web_search, WebSearchItem};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum AgentRunEvent {
    Chunk { delta: String },
    Done {
        messages: Value,
        #[serde(rename = "finalAnswer")]
        final_answer: String,
    },
    Error { message: String },
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum AgentInvestigateEvent {
    Step {
        step_id: String,
        label: String,
        status: String,
        detail: Option<String>,
    },
    Partial {
        patch: Value,
    },
    Done {
        report: Value,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum WorkerMessage {
    Ready,
    Chunk { id: String, delta: String },
    Done { id: String, result: Value },
    Error { id: Option<String>, message: String },
    Proxy {
        request_id: String,
        tool: String,
        args: Value,
    },
    #[serde(rename = "investigate_step")]
    InvestigateStep {
        id: String,
        step_id: String,
        label: String,
        status: String,
        detail: Option<String>,
    },
    #[serde(rename = "investigate_partial")]
    InvestigatePartial {
        id: String,
        patch: Value,
    },
    #[serde(rename = "investigate_done")]
    InvestigateDone {
        id: String,
        report: Value,
    },
}

struct AgentRuntime {
    /// Working directory for the Node worker (project root in dev, bundled runtime in release).
    work_dir: PathBuf,
    /// Data directory passed to the worker init payload.
    data_dir: PathBuf,
    node_bin: PathBuf,
    args: Vec<String>,
}

struct PendingRun {
    channel: Channel<AgentRunEvent>,
}

struct PendingInvestigate {
    channel: Channel<AgentInvestigateEvent>,
}

struct AgentNodeInner {
    child: Option<Child>,
    stdin: Option<Arc<Mutex<std::process::ChildStdin>>>,
    ready: bool,
    project_root: PathBuf,
    pending_runs: HashMap<String, PendingRun>,
    pending_investigates: HashMap<String, PendingInvestigate>,
}

pub struct AgentNodeState {
    inner: Arc<Mutex<AgentNodeInner>>,
}

impl AgentNodeState {
    pub fn new(project_root: PathBuf) -> Self {
        Self {
            inner: Arc::new(Mutex::new(AgentNodeInner {
                child: None,
                stdin: None,
                ready: false,
                project_root,
                pending_runs: HashMap::new(),
                pending_investigates: HashMap::new(),
            })),
        }
    }
}

pub fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("project root")
        .to_path_buf()
}

fn next_id(prefix: &str) -> String {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{prefix}-{ms}")
}

fn write_line(stdin: &mut std::process::ChildStdin, value: &Value) -> Result<(), String> {
    let mut line = serde_json::to_string(value).map_err(|e| e.to_string())?;
    line.push('\n');
    stdin.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
    stdin.flush().map_err(|e| e.to_string())
}

fn write_line_locked(
    stdin: &Arc<Mutex<std::process::ChildStdin>>,
    value: &Value,
) -> Result<(), String> {
    let mut guard = stdin.lock().map_err(|e| e.to_string())?;
    write_line(&mut guard, value)
}

fn bundled_runtime_dir(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().resource_dir().ok()?.join("agent-runtime");
    if dir.join("agent-runner.mjs").exists() {
        Some(dir)
    } else {
        None
    }
}

fn vendor_node_bin(project_root: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    let candidates = [
        project_root.join("vendor/node/current/bin/node.exe"),
        project_root.join("vendor/node/current-node.exe"),
    ];
    #[cfg(not(windows))]
    let candidates = [
        project_root.join("vendor/node/current/bin/node"),
        project_root.join("vendor/node/current-node"),
    ];

    candidates.into_iter().find(|p| p.exists())
}

fn system_node_bin() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        for name in ["node.exe", "node"] {
            if let Ok(output) = Command::new("where").arg(name).output() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if !path.is_empty() {
                    return Some(PathBuf::from(path));
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        for name in ["node", "nodejs"] {
            if let Ok(output) = Command::new("which").arg(name).output() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(PathBuf::from(path));
                }
            }
        }
    }
    None
}

pub fn which_node(app: &AppHandle) -> Result<PathBuf, String> {
    let root = project_root();
    if let Some(runtime) = bundled_runtime_dir(app) {
        #[cfg(windows)]
        let bin = runtime.join("bin/node.exe");
        #[cfg(not(windows))]
        let bin = runtime.join("bin/node");
        if bin.exists() {
            return Ok(bin);
        }
    }
    if let Some(bin) = vendor_node_bin(&root) {
        return Ok(bin);
    }
    system_node_bin().ok_or_else(|| "未找到 Node.js（请运行 npm run setup:node 或安装 Node 20+）".into())
}

fn resolve_runtime(app: &AppHandle) -> Result<AgentRuntime, String> {
    let project_root = project_root();

    if let Some(runtime_dir) = bundled_runtime_dir(app) {
        #[cfg(windows)]
        let node_bin = runtime_dir.join("bin/node.exe");
        #[cfg(not(windows))]
        let node_bin = runtime_dir.join("bin/node");
        if !node_bin.exists() {
            return Err(format!(
                "打包资源缺少 Node 二进制: {}",
                node_bin.display()
            ));
        }
        let script = runtime_dir.join("agent-runner.mjs");
        if !script.exists() {
            return Err(format!(
                "打包资源缺少 Agent runner: {}",
                script.display()
            ));
        }
        let data_dir = runtime_dir.join("data/experts");
        let data_dir = if data_dir.exists() {
            data_dir
        } else {
            project_root.join("data/experts")
        };
        return Ok(AgentRuntime {
            work_dir: runtime_dir,
            data_dir,
            node_bin,
            args: vec![script.to_string_lossy().into_owned()],
        });
    }

    // Dev: prefer vendor Node + bundled runner, then tsx + source
    let bundled_runner = project_root.join("dist/agent-runner.mjs");
    if let Some(node_bin) = vendor_node_bin(&project_root) {
        if bundled_runner.exists() {
            return Ok(AgentRuntime {
                work_dir: project_root.clone(),
                data_dir: project_root.join("data/experts"),
                node_bin,
                args: vec![bundled_runner.to_string_lossy().into_owned()],
            });
        }
    }

    let tsx = project_root.join("node_modules/.bin/tsx");
    let script = project_root.join("packages/agent/runner/stdio.ts");
    if !script.exists() {
        return Err(format!("找不到 Agent runner: {}", script.display()));
    }
    if tsx.exists() {
        let node_bin = system_node_bin()
            .ok_or_else(|| "未找到 Node.js，请先安装 Node 20+ 或运行 npm run setup:node".to_string())?;
        return Ok(AgentRuntime {
            work_dir: project_root.clone(),
            data_dir: project_root.join("data/experts"),
            node_bin,
            args: vec![
                tsx.to_string_lossy().into_owned(),
                script.to_string_lossy().into_owned(),
            ],
        });
    }

    let node_bin = system_node_bin()
        .ok_or_else(|| "未找到 Node.js，请先安装 Node 20+ 或运行 npm run setup:node".to_string())?;
    Ok(AgentRuntime {
        work_dir: project_root.clone(),
        data_dir: project_root.join("data/experts"),
        node_bin,
        args: vec![
            "--import".into(),
            "tsx".into(),
            script.to_string_lossy().into_owned(),
        ],
    })
}

fn sources_to_json(sources: &SourcesConfig) -> Value {
    json!({
        "semanticScholar": sources.semantic_scholar,
        "crossref": sources.crossref,
        "arxiv": sources.arxiv,
        "pubmed": sources.pubmed,
        "openAlex": sources.open_alex,
    })
}

fn build_init_payload(app: &AppHandle, runtime: &AgentRuntime, config: &AppConfig) -> Value {
    let mcp_s2 = config.mcp.semantic_scholar_enabled
        || std::env::var("WEAREGENG_MCP_S2_ENABLED").unwrap_or_default() == "1";
    let memory_db = memory_db_path(app).ok();
    json!({
        "type": "init",
        "projectRoot": runtime.work_dir.to_string_lossy(),
        "dataDir": runtime.data_dir.to_string_lossy(),
        "memoryDbPath": memory_db.as_ref().map(|p| p.to_string_lossy().to_string()),
        "config": {
            "llm": {
                "baseUrl": config.llm.base_url,
                "apiKey": config.llm.api_key,
                "model": config.llm.model,
                "temperature": config.llm.temperature,
            },
            "search": {
                "enabled": config.search.enabled,
                "provider": config.search.provider,
                "apiKey": config.search.api_key,
            },
            "sources": sources_to_json(&config.sources),
            "mcp": {
                "semanticScholarEnabled": mcp_s2,
            },
        },
        "mcpS2Enabled": mcp_s2,
    })
}

fn handle_proxy(app: &AppHandle, tool: &str, args: &Value) -> Result<Value, String> {
    match tool {
        "read_local_pdf" => {
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or("缺少 path")?;
            let res: PdfExtractResult = crate::pdf::pdf_extract_text(path.to_string())?;
            Ok(json!({
                "pages": res.pages,
                "text": res.text,
                "truncated": res.truncated,
            }))
        }
        "read_local_file" => {
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .ok_or("缺少 path")?;
            let content = crate::fs::fs_read_text(path.to_string())?;
            Ok(json!({ "content": content }))
        }
        "save_analysis" => {
            let paper_id = args
                .get("paperId")
                .and_then(|v| v.as_str())
                .ok_or("缺少 paperId")?
                .to_string();
            let paper_json = args
                .get("paperJson")
                .and_then(|v| v.as_str())
                .ok_or("缺少 paperJson")?
                .to_string();
            let id = args
                .get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| next_id("analysis"));
            let analyzed_at = args
                .get("analyzedAt")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    let ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis())
                        .unwrap_or(0);
                    format!("{ms}")
                });
            let db_state = app.state::<DbState>();
            save_analysis_record(
                &db_state,
                &SaveAnalysisArgs {
                    id: id.clone(),
                    paper_id,
                    paper_json,
                    summary: args.get("summary").and_then(|v| v.as_str()).map(String::from),
                    score: args.get("score").and_then(|v| v.as_f64()),
                    flags_json: args.get("flagsJson").and_then(|v| v.as_str()).map(String::from),
                    full_text: args.get("fullText").and_then(|v| v.as_str()).map(String::from),
                    analyzed_at,
                },
            )?;
            Ok(json!({ "ok": true, "id": id }))
        }
        "recall_analyses" => {
            let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as u32;
            let db_state = app.state::<DbState>();
            let rows: Vec<StoredAnalysis> = list_analyses(&db_state, limit)?;
            let analyses: Vec<Value> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "paperId": r.paper_id,
                        "summary": r.summary,
                        "score": r.score,
                        "analyzedAt": r.analyzed_at,
                    })
                })
                .collect();
            Ok(json!({ "analyses": analyses }))
        }
        "recall_memory" => {
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .ok_or("缺少 query")?
                .to_string();
            let session_id = args
                .get("sessionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let limit = args.get("limit").and_then(|v| v.as_u64()).map(|v| v as u32);
            let db_state = app.state::<DbState>();
            let hits = search_memory(
                &db_state,
                SearchMemoryArgs {
                    query,
                    session_id,
                    limit,
                },
            )?;
            let memories: Vec<Value> = hits
                .into_iter()
                .map(|h| {
                    json!({
                        "sessionId": h.session_id,
                        "sessionTitle": h.session_title,
                        "role": h.role,
                        "content": h.content,
                        "createdAt": h.created_at,
                    })
                })
                .collect();
            Ok(json!({ "memories": memories }))
        }
        "web_search" => {
            let query = args
                .get("query")
                .and_then(|v| v.as_str())
                .ok_or("缺少 query")?
                .to_string();
            let limit = args.get("limit").and_then(|v| v.as_u64()).map(|v| v as u32);
            let rt = tokio::runtime::Handle::try_current()
                .map_err(|_| "Tokio runtime 不可用".to_string())?;
            let items: Vec<WebSearchItem> = rt.block_on(web_search(app.clone(), query, limit))?;
            Ok(json!({ "results": items }))
        }
        other => Err(format!("未知 proxy tool: {other}")),
    }
}

fn spawn_worker(app: AppHandle, inner: Arc<Mutex<AgentNodeInner>>) -> Result<(), String> {
    {
        let guard = inner.lock().map_err(|e| e.to_string())?;
        if guard.child.is_some() {
            return Ok(());
        }
    }

    let runtime = resolve_runtime(&app)?;
    let mut child = Command::new(&runtime.node_bin)
        .args(&runtime.args)
        .current_dir(&runtime.work_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| format!("启动 Node Agent 失败: {e}"))?;

    let stdout = child.stdout.take().ok_or("无法读取 Node Agent stdout")?;
    let stdin = child.stdin.take().ok_or("无法写入 Node Agent stdin")?;
    let stdin_arc = Arc::new(Mutex::new(stdin));

    {
        let mut guard = inner.lock().map_err(|e| e.to_string())?;
        guard.child = Some(child);
        guard.stdin = Some(stdin_arc.clone());
        guard.ready = false;
    }

    let config = load_config(&app)?;
    write_line_locked(&stdin_arc, &build_init_payload(&app, &runtime, &config))?;

    let inner_wait = inner.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else { break };
            if line.trim().is_empty() {
                continue;
            }
            let Ok(msg) = serde_json::from_str::<WorkerMessage>(&line) else {
                continue;
            };

            match msg {
                WorkerMessage::Ready => {
                    if let Ok(mut guard) = inner.lock() {
                        guard.ready = true;
                    }
                }
                WorkerMessage::Chunk { id, delta } => {
                    if let Ok(guard) = inner.lock() {
                        if let Some(pending) = guard.pending_runs.get(&id) {
                            let _ = pending.channel.send(AgentRunEvent::Chunk { delta });
                        }
                    }
                }
                WorkerMessage::Done { id, result } => {
                    let pending = inner
                        .lock()
                        .ok()
                        .and_then(|mut guard| guard.pending_runs.remove(&id));
                    if let Some(pending) = pending {
                        let messages = result.get("messages").cloned().unwrap_or_else(|| json!([]));
                        let final_answer = result
                            .get("finalAnswer")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let _ = pending.channel.send(AgentRunEvent::Done {
                            messages,
                            final_answer,
                        });
                    }
                }
                WorkerMessage::InvestigateStep {
                    id,
                    step_id,
                    label,
                    status,
                    detail,
                } => {
                    if let Ok(guard) = inner.lock() {
                        if let Some(pending) = guard.pending_investigates.get(&id) {
                            let _ = pending.channel.send(AgentInvestigateEvent::Step {
                                step_id,
                                label,
                                status,
                                detail,
                            });
                        }
                    }
                }
                WorkerMessage::InvestigatePartial { id, patch } => {
                    if let Ok(guard) = inner.lock() {
                        if let Some(pending) = guard.pending_investigates.get(&id) {
                            let _ = pending.channel.send(AgentInvestigateEvent::Partial { patch });
                        }
                    }
                }
                WorkerMessage::InvestigateDone { id, report } => {
                    let pending = inner
                        .lock()
                        .ok()
                        .and_then(|mut guard| guard.pending_investigates.remove(&id));
                    if let Some(pending) = pending {
                        let _ = pending.channel.send(AgentInvestigateEvent::Done { report });
                    }
                }
                WorkerMessage::Error { id, message } => {
                    if let Some(id) = id {
                        let pending_run = inner
                            .lock()
                            .ok()
                            .and_then(|mut guard| guard.pending_runs.remove(&id));
                        if let Some(pending) = pending_run {
                            let _ = pending.channel.send(AgentRunEvent::Error { message: message.clone() });
                            continue;
                        }
                        let pending_inv = inner
                            .lock()
                            .ok()
                            .and_then(|mut guard| guard.pending_investigates.remove(&id));
                        if let Some(pending) = pending_inv {
                            let _ = pending.channel.send(AgentInvestigateEvent::Error { message });
                        }
                    }
                }
                WorkerMessage::Proxy {
                    request_id,
                    tool,
                    args,
                } => {
                    let result = handle_proxy(&app, &tool, &args);
                    let payload = match result {
                        Ok(value) => json!({
                            "type": "proxy_result",
                            "requestId": request_id,
                            "ok": true,
                            "result": value,
                        }),
                        Err(err) => json!({
                            "type": "proxy_result",
                            "requestId": request_id,
                            "ok": false,
                            "error": err,
                        }),
                    };
                    let _ = write_line_locked(&stdin_arc, &payload);
                }
            }
        }
    });

    for _ in 0..100 {
        if inner_wait.lock().map(|g| g.ready).unwrap_or(false) {
            break;
        }
        thread::sleep(Duration::from_millis(50));
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRunRequest {
    pub user_input: String,
    pub history: Value,
    pub session_id: Option<String>,
}

#[tauri::command]
pub fn agent_node_status(
    app: AppHandle,
    node_state: State<'_, AgentNodeState>,
) -> Result<Value, String> {
    let inner = node_state.inner.lock().map_err(|e| e.to_string())?;
    let node_ok = which_node(&app).is_ok();
    let runtime_ok = resolve_runtime(&app).is_ok();
    Ok(json!({
        "available": node_ok && runtime_ok,
        "nodeAvailable": node_ok,
        "runtimeAvailable": runtime_ok,
        "bundled": bundled_runtime_dir(&app).is_some(),
        "running": inner.child.is_some(),
        "ready": inner.ready,
        "projectRoot": inner.project_root,
    }))
}

#[tauri::command]
pub async fn agent_run(
    app: AppHandle,
    node_state: State<'_, AgentNodeState>,
    request: AgentRunRequest,
    on_event: Channel<AgentRunEvent>,
) -> Result<(), String> {
    if which_node(&app).is_err() || resolve_runtime(&app).is_err() {
        on_event
            .send(AgentRunEvent::Error {
                message: "Node Agent 不可用（请运行 npm run setup:node 或安装 Node 20+）".into(),
            })
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    spawn_worker(app.clone(), node_state.inner.clone())?;

    let run_id = next_id("run");
    let payload = json!({
        "type": "run",
        "id": run_id,
        "userInput": request.user_input,
        "history": request.history,
        "sessionId": request.session_id,
    });

    let mut inner = node_state.inner.lock().map_err(|e| e.to_string())?;
    inner.pending_runs.insert(
        run_id.clone(),
        PendingRun {
            channel: on_event,
        },
    );

    let config = load_config(&app)?;
    let runtime = resolve_runtime(&app)?;
    let stdin = inner
        .stdin
        .clone()
        .ok_or_else(|| {
            inner.pending_runs.remove(&run_id);
            "Node Agent 未就绪".to_string()
        })?;

    write_line_locked(&stdin, &build_init_payload(&app, &runtime, &config))?;
    if let Err(err) = write_line_locked(&stdin, &payload) {
        inner.pending_runs.remove(&run_id);
        return Err(err);
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInvestigateRequest {
    pub name: String,
    pub university: Option<String>,
    pub max_papers: Option<u32>,
}

#[tauri::command]
pub async fn agent_investigate(
    app: AppHandle,
    node_state: State<'_, AgentNodeState>,
    request: AgentInvestigateRequest,
    on_event: Channel<AgentInvestigateEvent>,
) -> Result<(), String> {
    if which_node(&app).is_err() || resolve_runtime(&app).is_err() {
        on_event
            .send(AgentInvestigateEvent::Error {
                message: "Node Agent 不可用（请运行 npm run setup:node 或安装 Node 20+）".into(),
            })
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    spawn_worker(app.clone(), node_state.inner.clone())?;

    let run_id = next_id("investigate");
    let payload = json!({
        "type": "investigate",
        "id": run_id,
        "name": request.name,
        "university": request.university,
        "maxPapers": request.max_papers,
    });

    let mut inner = node_state.inner.lock().map_err(|e| e.to_string())?;
    inner.pending_investigates.insert(
        run_id.clone(),
        PendingInvestigate {
            channel: on_event,
        },
    );

    let config = load_config(&app)?;
    let runtime = resolve_runtime(&app)?;
    let stdin = inner
        .stdin
        .clone()
        .ok_or_else(|| {
            inner.pending_investigates.remove(&run_id);
            "Node Agent 未就绪".to_string()
        })?;

    write_line_locked(&stdin, &build_init_payload(&app, &runtime, &config))?;
    if let Err(err) = write_line_locked(&stdin, &payload) {
        inner.pending_investigates.remove(&run_id);
        return Err(err);
    }

    Ok(())
}

#[tauri::command]
pub fn agent_investigate_cancel(node_state: State<'_, AgentNodeState>) -> Result<(), String> {
    let mut inner = node_state.inner.lock().map_err(|e| e.to_string())?;
    if inner.pending_investigates.is_empty() {
        return Ok(());
    }

    for (_, pending) in inner.pending_investigates.drain() {
        let _ = pending.channel.send(AgentInvestigateEvent::Error {
            message: "调查已取消".into(),
        });
    }

    if let Some(mut child) = inner.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    inner.stdin = None;
    inner.ready = false;

    Ok(())
}

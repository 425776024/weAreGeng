use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
}

/// Partial LLM update from the frontend; omitted or empty fields keep existing values.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfigPatch {
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    pub temperature: Option<f64>,
}

/// Partial search update; omitted fields keep existing values.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchConfigPatch {
    pub enabled: Option<bool>,
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchConfig {
    pub enabled: bool,
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourcesConfig {
    pub semantic_scholar: bool,
    pub crossref: bool,
    pub arxiv: bool,
    pub pubmed: bool,
    pub open_alex: bool,
}

impl Default for SourcesConfig {
    fn default() -> Self {
        Self {
            semantic_scholar: true,
            crossref: true,
            arxiv: true,
            pubmed: false,
            open_alex: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    #[serde(default = "default_semantic_scholar_mcp")]
    pub semantic_scholar_enabled: bool,
}

fn default_semantic_scholar_mcp() -> bool {
    true
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            semantic_scholar_enabled: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub llm: LlmConfig,
    pub search: SearchConfig,
    #[serde(default)]
    pub sources: SourcesConfig,
    #[serde(default)]
    pub mcp: McpConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            llm: LlmConfig {
                base_url: "https://api.openai.com/v1".into(),
                api_key: String::new(),
                model: "gpt-4o-mini".into(),
                temperature: 0.2,
            },
            search: SearchConfig {
                enabled: true,
                provider: "duckduckgo".into(),
                api_key: String::new(),
            },
            sources: SourcesConfig::default(),
            mcp: McpConfig::default(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigResponse {
    pub llm: LlmConfigMasked,
    pub search: SearchConfigMasked,
    pub sources: SourcesConfig,
    pub mcp: McpConfig,
    pub llm_configured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfigMasked {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub temperature: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchConfigMasked {
    pub enabled: bool,
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfigResponse {
    pub ok: bool,
    pub llm_configured: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestLlmResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn uses_mimo_api_key_auth(base_url: &str, api_key: &str) -> bool {
    api_key.starts_with("tp-") || base_url.contains("xiaomimimo")
}

pub struct LlmAuthHeaders {
    pub auth_name: &'static str,
    pub auth_value: String,
}

impl LlmAuthHeaders {
    pub fn new(base_url: &str, api_key: &str) -> Self {
        if uses_mimo_api_key_auth(base_url, api_key) {
            Self {
                auth_name: "api-key",
                auth_value: api_key.to_string(),
            }
        } else {
            Self {
                auth_name: "Authorization",
                auth_value: format!("Bearer {}", api_key),
            }
        }
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())
        .map(|dir| dir.join("config.json"))
}

fn sanitize_stored_api_key(key: &mut String) {
    *key = key.trim().to_string();
    if *key == "***" {
        key.clear();
    }
}

pub fn load_config(app: &AppHandle) -> Result<AppConfig, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut config: AppConfig = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let llm_before = config.llm.api_key.clone();
    let search_before = config.search.api_key.clone();
    sanitize_stored_api_key(&mut config.llm.api_key);
    sanitize_stored_api_key(&mut config.search.api_key);
    if config.llm.api_key != llm_before || config.search.api_key != search_before {
        let _ = save_config(app, &config);
    }
    let defaults = AppConfig::default();
    if config.llm.base_url.is_empty() {
        config.llm.base_url = defaults.llm.base_url;
    }
    if config.llm.model.is_empty() {
        config.llm.model = defaults.llm.model;
    }
    Ok(config)
}

fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

fn mask_config(config: &AppConfig) -> ConfigResponse {
    ConfigResponse {
        llm: LlmConfigMasked {
            base_url: config.llm.base_url.clone(),
            api_key: if config.llm.api_key.is_empty() {
                String::new()
            } else {
                "***".into()
            },
            model: config.llm.model.clone(),
            temperature: config.llm.temperature,
        },
        search: SearchConfigMasked {
            enabled: config.search.enabled,
            provider: config.search.provider.clone(),
            api_key: if config.search.api_key.is_empty() {
                String::new()
            } else {
                "***".into()
            },
        },
        sources: config.sources.clone(),
        mcp: config.mcp.clone(),
        llm_configured: !config.llm.api_key.is_empty() && config.llm.api_key != "***",
    }
}

fn normalize_patch_api_key(value: String) -> String {
    let trimmed = value.trim().to_string();
    if trimmed == "***" {
        String::new()
    } else {
        trimmed
    }
}

fn merge_llm(current: &LlmConfig, patch: Option<LlmConfigPatch>) -> LlmConfig {
    let Some(patch) = patch else {
        return current.clone();
    };
    let patch_key = normalize_patch_api_key(patch.api_key);
    LlmConfig {
        base_url: if patch.base_url.is_empty() {
            current.base_url.clone()
        } else {
            patch.base_url.trim().to_string()
        },
        api_key: if patch_key.is_empty() {
            current.api_key.clone()
        } else {
            patch_key
        },
        model: if patch.model.is_empty() {
            current.model.clone()
        } else {
            patch.model
        },
        temperature: patch.temperature.unwrap_or(current.temperature),
    }
}

fn merge_search(current: &SearchConfig, patch: SearchConfigPatch) -> SearchConfig {
    let patch_key = normalize_patch_api_key(patch.api_key);
    SearchConfig {
        enabled: patch.enabled.unwrap_or(current.enabled),
        provider: if patch.provider.is_empty() {
            current.provider.clone()
        } else {
            patch.provider
        },
        api_key: if patch_key.is_empty() {
            current.api_key.clone()
        } else {
            patch_key
        },
    }
}

#[tauri::command]
pub fn get_config(app: AppHandle) -> Result<ConfigResponse, String> {
    let config = load_config(&app)?;
    Ok(mask_config(&config))
}

#[tauri::command]
pub fn update_config(app: AppHandle, body: Value) -> Result<UpdateConfigResponse, String> {
    let mut config = load_config(&app)?;

    if let Some(llm) = body.get("llm") {
        if let Ok(patch) = serde_json::from_value::<LlmConfigPatch>(llm.clone()) {
            config.llm = merge_llm(&config.llm, Some(patch));
        }
    }

    if let Some(search) = body.get("search") {
        if let Ok(patch) = serde_json::from_value::<SearchConfigPatch>(search.clone()) {
            config.search = merge_search(&config.search, patch);
        }
    }

    if let Some(sources) = body.get("sources") {
        if let Ok(patch) = serde_json::from_value::<SourcesConfig>(sources.clone()) {
            config.sources = patch;
        }
    }

    if let Some(mcp) = body.get("mcp") {
        if let Ok(patch) = serde_json::from_value::<McpConfig>(mcp.clone()) {
            config.mcp = patch;
        }
    }

    save_config(&app, &config)?;
    Ok(UpdateConfigResponse {
        ok: true,
        llm_configured: !config.llm.api_key.is_empty() && config.llm.api_key != "***",
    })
}

#[tauri::command]
pub async fn test_llm(app: AppHandle, llm: Option<LlmConfigPatch>) -> Result<TestLlmResponse, String> {
    let config = load_config(&app)?;
    let llm = merge_llm(&config.llm, llm);

    if llm.api_key.is_empty() || llm.api_key == "***" {
        return Ok(TestLlmResponse {
            ok: false,
            reply: None,
            error: Some("请先输入有效的 API Key 并保存".into()),
        });
    }

    let body = serde_json::json!({
        "model": llm.model,
        "temperature": llm.temperature,
        "max_tokens": 16,
        "messages": [{ "role": "user", "content": "Reply with exactly: OK" }]
    });

    let url = format!("{}/chat/completions", llm.base_url.trim_end_matches('/'));
    let auth = LlmAuthHeaders::new(&llm.base_url, &llm.api_key);
    let auth_value = auth.auth_value.as_str();
    let headers = [
        ("Content-Type", "application/json"),
        (auth.auth_name, auth_value),
    ];

    match crate::proxy::send_http(
        "POST",
        &url,
        Some(&headers),
        Some(body.to_string()),
        Some(60),
    )
    .await
    {
        Ok(response) if response.status >= 200 && response.status < 300 => {
            let data: Value = serde_json::from_str(&response.body).unwrap_or(Value::Null);
            let reply = data
                .pointer("/choices/0/message/content")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "连接成功".into());
            Ok(TestLlmResponse {
                ok: true,
                reply: Some(reply),
                error: None,
            })
        }
        Ok(response) => {
            let err = extract_error_message(&response.body, response.status);
            Ok(TestLlmResponse {
                ok: false,
                reply: None,
                error: Some(err),
            })
        }
        Err(err) => Ok(TestLlmResponse {
            ok: false,
            reply: None,
            error: Some(err),
        }),
    }
}

pub fn extract_error_message(body: &str, status: u16) -> String {
    if let Ok(json) = serde_json::from_str::<Value>(body) {
        if let Some(msg) = json.pointer("/error/message").and_then(|v| v.as_str()) {
            return msg.to_string();
        }
        if let Some(msg) = json.get("message").and_then(|v| v.as_str()) {
            return msg.to_string();
        }
    }
    if body.is_empty() {
        format!("HTTP {status}")
    } else {
        body.chars().take(200).collect()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmChatRequest {
    pub messages: Vec<Value>,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    pub response_format: Option<Value>,
    pub tools: Option<Value>,
}

fn default_max_tokens() -> u32 {
    2048
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmChatResponse {
    pub content: String,
    pub tool_calls: Option<Value>,
    pub finish_reason: Option<String>,
}

#[tauri::command]
pub async fn llm_chat(app: AppHandle, request: LlmChatRequest) -> Result<LlmChatResponse, String> {
    let config = load_config(&app)?;
    let llm = &config.llm;

    if llm.api_key.is_empty() {
        return Err("请先配置并保存 API Key".into());
    }

    let mut body = serde_json::json!({
        "model": llm.model,
        "temperature": llm.temperature,
        "max_tokens": request.max_tokens,
        "messages": request.messages,
    });

    if let Some(fmt) = request.response_format {
        body["response_format"] = fmt;
    }

    if let Some(tools) = request.tools {
        body["tools"] = tools;
    }

    let url = format!("{}/chat/completions", llm.base_url.trim_end_matches('/'));
    let auth = LlmAuthHeaders::new(&llm.base_url, &llm.api_key);
    let auth_value = auth.auth_value.as_str();
    let headers = [
        ("Content-Type", "application/json"),
        (auth.auth_name, auth_value),
    ];

    let response = crate::proxy::send_http(
        "POST",
        &url,
        Some(&headers),
        Some(body.to_string()),
        Some(120),
    )
    .await?;

    if response.status < 200 || response.status >= 300 {
        return Err(extract_error_message(&response.body, response.status));
    }

    let data: Value = serde_json::from_str(&response.body).map_err(|e| e.to_string())?;
    let choice = data.pointer("/choices/0").ok_or("LLM 响应格式异常")?;
    let content = choice
        .pointer("/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let tool_calls = choice.get("message").and_then(|m| m.get("tool_calls")).cloned();
    let finish_reason = choice
        .get("finish_reason")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if content.is_empty() && tool_calls.is_none() {
        return Err("LLM 返回为空".into());
    }

    Ok(LlmChatResponse {
        content,
        tool_calls,
        finish_reason,
    })
}

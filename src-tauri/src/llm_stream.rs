use crate::config::{load_config, LlmAuthHeaders, LlmChatRequest};
use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::AppHandle;

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum LlmStreamEvent {
    Chunk { delta: String },
    Done {
        content: String,
        #[serde(rename = "toolCalls")]
        tool_calls: Option<serde_json::Value>,
        #[serde(rename = "finishReason")]
        finish_reason: Option<String>,
    },
    Error { message: String },
}

#[tauri::command]
pub async fn llm_chat_stream(
    app: AppHandle,
    request: LlmChatRequest,
    on_event: Channel<LlmStreamEvent>,
) -> Result<(), String> {
    let config = load_config(&app)?;
    let llm = &config.llm;
    if llm.api_key.is_empty() {
        on_event
            .send(LlmStreamEvent::Error {
                message: "请先配置并保存 API Key".into(),
            })
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut body = serde_json::json!({
        "model": llm.model,
        "temperature": llm.temperature,
        "max_tokens": request.max_tokens,
        "messages": request.messages,
        "stream": true,
    });
    if let Some(fmt) = request.response_format {
        body["response_format"] = fmt;
    }
    if let Some(tools) = request.tools {
        body["tools"] = tools;
    }

    let url = format!("{}/chat/completions", llm.base_url.trim_end_matches('/'));
    let auth = LlmAuthHeaders::new(&llm.base_url, &llm.api_key);
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header(auth.auth_name, auth.auth_value)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        on_event
            .send(LlmStreamEvent::Error {
                message: crate::config::extract_error_message(&body, status),
            })
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_content = String::new();
    let mut tool_calls: Option<serde_json::Value> = None;
    let mut finish_reason: Option<String> = None;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(pos) = buffer.find("\n\n") {
            let block = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();

            for line in block.lines() {
                let line = line.trim();
                if !line.starts_with("data:") {
                    continue;
                }
                let data = line.trim_start_matches("data:").trim();
                if data == "[DONE]" {
                    continue;
                }
                let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
                    continue;
                };
                if let Some(reason) = json.pointer("/choices/0/finish_reason").and_then(|v| v.as_str()) {
                    finish_reason = Some(reason.to_string());
                }
                if let Some(delta) = json.pointer("/choices/0/delta/content").and_then(|v| v.as_str()) {
                    if !delta.is_empty() {
                        full_content.push_str(delta);
                        on_event
                            .send(LlmStreamEvent::Chunk { delta: delta.to_string() })
                            .map_err(|e| e.to_string())?;
                    }
                }
                if let Some(calls) = json.pointer("/choices/0/delta/tool_calls") {
                    if !calls.is_null() {
                        tool_calls = Some(calls.clone());
                    }
                }
            }
        }
    }

    on_event
        .send(LlmStreamEvent::Done {
            content: full_content,
            tool_calls,
            finish_reason,
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

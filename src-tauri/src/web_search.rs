use crate::config::load_config;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchItem {
    pub title: String,
    pub url: String,
    pub snippet: String,
}

#[tauri::command]
pub async fn web_search(
    app: AppHandle,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WebSearchItem>, String> {
    let config = load_config(&app)?;
    if !config.search.enabled {
        return Ok(vec![]);
    }
    let limit = limit.unwrap_or(8).min(20) as usize;
    let q = query.trim();
    if q.is_empty() {
        return Ok(vec![]);
    }

    match config.search.provider.as_str() {
        "serper" => search_serper(&config.search.api_key, q, limit).await,
        "tavily" => search_tavily(&config.search.api_key, q, limit).await,
        _ => search_duckduckgo(q, limit).await,
    }
}

async fn search_serper(api_key: &str, query: &str, limit: usize) -> Result<Vec<WebSearchItem>, String> {
    if api_key.is_empty() {
        return Err("Serper 需要 API Key".into());
    }
    let body = serde_json::json!({ "q": query, "num": limit });
    let response = crate::proxy::send_http(
        "POST",
        "https://google.serper.dev/search",
        Some(&[
            ("Content-Type", "application/json"),
            ("X-API-KEY", api_key),
        ]),
        Some(body.to_string()),
        Some(30),
    )
    .await?;
    if response.status < 200 || response.status >= 300 {
        return Err(format!("Serper HTTP {}", response.status));
    }
    let data: serde_json::Value = serde_json::from_str(&response.body).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    if let Some(items) = data.get("organic").and_then(|v| v.as_array()) {
        for item in items.iter().take(limit) {
            out.push(WebSearchItem {
                title: item.get("title").and_then(|v| v.as_str()).unwrap_or("").into(),
                url: item.get("link").and_then(|v| v.as_str()).unwrap_or("").into(),
                snippet: item.get("snippet").and_then(|v| v.as_str()).unwrap_or("").into(),
            });
        }
    }
    Ok(out)
}

async fn search_tavily(api_key: &str, query: &str, limit: usize) -> Result<Vec<WebSearchItem>, String> {
    if api_key.is_empty() {
        return Err("Tavily 需要 API Key".into());
    }
    let body = serde_json::json!({
        "api_key": api_key,
        "query": query,
        "max_results": limit,
        "search_depth": "basic"
    });
    let response = crate::proxy::send_http(
        "POST",
        "https://api.tavily.com/search",
        Some(&[("Content-Type", "application/json")]),
        Some(body.to_string()),
        Some(30),
    )
    .await?;
    if response.status < 200 || response.status >= 300 {
        return Err(format!("Tavily HTTP {}", response.status));
    }
    let data: serde_json::Value = serde_json::from_str(&response.body).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    if let Some(items) = data.get("results").and_then(|v| v.as_array()) {
        for item in items.iter().take(limit) {
            out.push(WebSearchItem {
                title: item.get("title").and_then(|v| v.as_str()).unwrap_or("").into(),
                url: item.get("url").and_then(|v| v.as_str()).unwrap_or("").into(),
                snippet: item.get("content").and_then(|v| v.as_str()).unwrap_or("").into(),
            });
        }
    }
    Ok(out)
}

async fn search_duckduckgo(query: &str, limit: usize) -> Result<Vec<WebSearchItem>, String> {
    let url = format!(
        "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
        urlencoding::encode(query)
    );
    let response = crate::proxy::send_http("GET", &url, None, None, Some(30)).await?;
    if response.status < 200 || response.status >= 300 {
        return Ok(vec![]);
    }
    let data: serde_json::Value = serde_json::from_str(&response.body).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    if let (Some(text), Some(link)) = (
        data.get("AbstractText").and_then(|v| v.as_str()),
        data.get("AbstractURL").and_then(|v| v.as_str()),
    ) {
        out.push(WebSearchItem {
            title: data
                .get("Heading")
                .and_then(|v| v.as_str())
                .unwrap_or(query)
                .into(),
            url: link.into(),
            snippet: text.into(),
        });
    }
    if let Some(topics) = data.get("RelatedTopics").and_then(|v| v.as_array()) {
        for topic in topics {
            if out.len() >= limit {
                break;
            }
            if let (Some(text), Some(url)) = (
                topic.get("Text").and_then(|v| v.as_str()),
                topic.get("FirstURL").and_then(|v| v.as_str()),
            ) {
                out.push(WebSearchItem {
                    title: text.chars().take(80).collect(),
                    url: url.into(),
                    snippet: text.into(),
                });
            }
            if let Some(subs) = topic.get("Topics").and_then(|v| v.as_array()) {
                for sub in subs {
                    if out.len() >= limit {
                        break;
                    }
                    if let (Some(text), Some(url)) = (
                        sub.get("Text").and_then(|v| v.as_str()),
                        sub.get("FirstURL").and_then(|v| v.as_str()),
                    ) {
                        out.push(WebSearchItem {
                            title: text.chars().take(80).collect(),
                            url: url.into(),
                            snippet: text.into(),
                        });
                    }
                }
            }
        }
    }
    Ok(out.into_iter().take(limit).collect())
}

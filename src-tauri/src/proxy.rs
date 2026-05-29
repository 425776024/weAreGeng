use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

pub async fn send_http(
    method: &str,
    url: &str,
    headers: Option<&[(&str, &str)]>,
    body: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<HttpProxyResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs.unwrap_or(120)))
        .build()
        .map_err(|e| e.to_string())?;

    let method = method.to_uppercase();
    let mut request = match method.as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        "PUT" => client.put(url),
        "PATCH" => client.patch(url),
        "DELETE" => client.delete(url),
        "HEAD" => client.head(url),
        other => return Err(format!("不支持的 HTTP 方法: {other}")),
    };

    if let Some(headers) = headers {
        for (key, value) in headers {
            request = request.header(*key, *value);
        }
    }

    if let Some(body) = body {
        request = request.body(body);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let response_headers = response
        .headers()
        .iter()
        .filter_map(|(key, value)| {
            value
                .to_str()
                .ok()
                .map(|v| (key.as_str().to_string(), v.to_string()))
        })
        .collect();
    let body = response.text().await.map_err(|e| e.to_string())?;

    Ok(HttpProxyResponse {
        status,
        headers: response_headers,
        body,
    })
}

#[tauri::command]
pub async fn http_proxy(request: HttpProxyRequest) -> Result<HttpProxyResponse, String> {
    let header_pairs: Vec<(String, String)> = request
        .headers
        .into_iter()
        .map(|(k, v)| (k, v))
        .collect();
    let refs: Vec<(&str, &str)> = header_pairs
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_str()))
        .collect();

    send_http(
        &request.method,
        &request.url,
        Some(&refs),
        request.body,
        request.timeout_secs,
    )
    .await
}

use serde::Serialize;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickFileResult {
    pub path: Option<String>,
}

#[tauri::command]
pub async fn fs_pick_file(
    app: tauri::AppHandle,
    filters: Option<Vec<String>>,
) -> Result<PickFileResult, String> {
    let (tx, rx) = oneshot::channel();
    let mut dialog = app.dialog().file();
    if let Some(f) = filters {
        if !f.is_empty() {
            let refs: Vec<&str> = f.iter().map(|s| s.as_str()).collect();
            dialog = dialog.add_filter("Files", &refs);
        }
    }
    dialog.pick_file(move |path| {
        let _ = tx.send(path);
    });
    let path = rx.await.map_err(|_| "文件选择已取消".to_string())?;
    Ok(PickFileResult {
        path: path.map(|p| p.to_string()),
    })
}

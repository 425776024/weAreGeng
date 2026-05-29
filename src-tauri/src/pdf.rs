use serde::Serialize;
use std::fs;
use std::path::PathBuf;

const MAX_PDF_BYTES: u64 = 50 * 1024 * 1024; // 50 MB
const MAX_TEXT_CHARS: usize = 500_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfExtractResult {
    pub text: String,
    pub pages: u32,
    pub truncated: bool,
}

fn validate_pdf_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err("路径必须是绝对路径".into());
    }
    if !p.exists() {
        return Err(format!("文件不存在: {path}"));
    }
    if !p.is_file() {
        return Err("路径不是文件".into());
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "pdf" {
        return Err("仅支持 PDF 文件".into());
    }
    Ok(p)
}

#[tauri::command]
pub fn pdf_extract_text(path: String) -> Result<PdfExtractResult, String> {
    let p = validate_pdf_path(&path)?;
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.len() > MAX_PDF_BYTES {
        return Err(format!("PDF 过大（上限 {} MB）", MAX_PDF_BYTES / 1024 / 1024));
    }

    let bytes = fs::read(&p).map_err(|e| format!("读取 PDF 失败: {e}"))?;
    let doc = pdf_extract::extract_text_from_mem(&bytes).map_err(|e| format!("PDF 解析失败: {e}"))?;

    let pages = doc.split('\x0c').count().max(1) as u32;
    let truncated = doc.len() > MAX_TEXT_CHARS;
    let text = if truncated {
        doc.chars().take(MAX_TEXT_CHARS).collect()
    } else {
        doc
    };

    Ok(PdfExtractResult {
        text,
        pages,
        truncated,
    })
}

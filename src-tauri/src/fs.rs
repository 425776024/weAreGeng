use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

const MAX_TEXT_BYTES: u64 = 10 * 1024 * 1024; // 10 MB

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

fn validate_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err("路径必须是绝对路径".into());
    }
    for component in p.components() {
        if matches!(component, Component::ParentDir) {
            return Err("路径不允许包含 ..".into());
        }
    }
    Ok(p)
}

#[tauri::command]
pub fn fs_read_text(path: String) -> Result<String, String> {
    let p = validate_path(&path)?;
    if !p.exists() {
        return Err(format!("文件不存在: {path}"));
    }
    if !p.is_file() {
        return Err("路径不是文件".into());
    }
    let meta = fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.len() > MAX_TEXT_BYTES {
        return Err(format!("文件过大（上限 {} MB）", MAX_TEXT_BYTES / 1024 / 1024));
    }
    fs::read_to_string(&p).map_err(|e| format!("读取文件失败: {e}"))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsListDirArgs {
    pub path: String,
    #[serde(default)]
    pub recursive: bool,
}

#[tauri::command]
pub fn fs_list_dir(args: FsListDirArgs) -> Result<Vec<FileEntry>, String> {
    let p = validate_path(&args.path)?;
    if !p.is_dir() {
        return Err("路径不是目录".into());
    }

    let mut entries = Vec::new();
    collect_dir(&p, &p, args.recursive, &mut entries, 0)?;
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

fn collect_dir(
    root: &Path,
    dir: &Path,
    recursive: bool,
    out: &mut Vec<FileEntry>,
    depth: usize,
) -> Result<(), String> {
    if depth > 5 {
        return Ok(());
    }
    let read_dir = fs::read_dir(dir).map_err(|e| format!("读取目录失败: {e}"))?;
    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let size = if ft.is_file() {
            entry.metadata().map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };
        out.push(FileEntry {
            name,
            path: path.to_string_lossy().into_owned(),
            is_dir: ft.is_dir(),
            size,
        });
        if recursive && ft.is_dir() {
            collect_dir(root, &path, true, out, depth + 1)?;
        }
    }
    Ok(())
}

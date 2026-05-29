mod agent_node;
mod config;
mod db;
mod dialog;
mod fs;
mod llm_stream;
mod pdf;
mod proxy;
mod web_search;

use db::{init_db, DbState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let conn = init_db(app.handle())?;
            app.manage(DbState {
                conn: std::sync::Mutex::new(conn),
            });
            app.manage(agent_node::AgentNodeState::new(agent_node::project_root()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::update_config,
            config::test_llm,
            config::llm_chat,
            llm_stream::llm_chat_stream,
            proxy::http_proxy,
            web_search::web_search,
            fs::fs_read_text,
            fs::fs_list_dir,
            pdf::pdf_extract_text,
            dialog::fs_pick_file,
            db::db_save_analysis,
            db::db_list_analyses,
            db::db_create_session,
            db::db_list_sessions,
            db::db_save_message,
            db::db_list_messages,
            db::db_search_memory,
            db::db_delete_session,
            db::db_save_bookmark,
            db::db_list_bookmarks,
            db::db_delete_bookmark,
            agent_node::agent_node_status,
            agent_node::agent_run,
            agent_node::agent_investigate,
            agent_node::agent_investigate_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

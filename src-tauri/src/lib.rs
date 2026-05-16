//! This module provides the backend functionality for the HRX IDE.
//! It includes workspace file management, Git integration, and Tauri command bindings.

use std::sync::Mutex;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use std::fs;
use std::collections::HashMap;
use std::process::{Command, Child, Stdio};
use std::io::{BufReader, BufRead, Write};
use std::thread;
use tauri::{State, Emitter, Window};

/// The global application state managed by Tauri.
pub struct AppState {
    /// A thread-safe list of active workspace directory paths.
    work_dirs: Mutex<Vec<PathBuf>>,
    /// A registry of spawned child processes mapped by a unique ID.
    processes: Mutex<HashMap<String, Child>>,
}

/// Represents a file or directory node in the workspace file tree.
#[derive(Serialize)]
pub struct FileNode {
    /// The local name of the file or directory.
    name: String,
    /// The absolute path to the file or directory.
    path: String,
    /// Identifies whether this node is a file or a directory.
    #[serde(rename = "type")]
    node_type: String,
    /// If this is a directory, contains the nested children nodes.
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileNode>>,
}

/// Recursively builds a file tree representation starting from the given directory.
/// 
/// Ignores `node_modules` and `.git` directories.
/// 
/// # Arguments
/// * `dir` - The starting directory path.
/// 
/// # Returns
/// A `Result` containing a vector of `FileNode` on success, or an error message string on failure.
fn build_tree(dir: &Path) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == "node_modules" || file_name == ".git" {
            continue;
        }

        let path = entry.path();
        let abs_path = path.to_string_lossy().replace("\\", "/");
        
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        if file_type.is_dir() {
            let children = build_tree(&path)?;
            nodes.push(FileNode {
                name: file_name,
                path: abs_path,
                node_type: "directory".to_string(),
                children: Some(children),
            });
        } else {
            nodes.push(FileNode {
                name: file_name,
                path: abs_path,
                node_type: "file".to_string(),
                children: None,
            });
        }
    }

    nodes.sort_by(|a, b| {
        if a.node_type == b.node_type {
            a.name.cmp(&b.name)
        } else if a.node_type == "directory" {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(nodes)
}

/// Retrieves the full file tree for all active workspace directories.
#[tauri::command]
fn get_files(state: State<'_, AppState>) -> Result<Vec<FileNode>, String> {
    let work_dirs = state.work_dirs.lock().unwrap().clone();
    let mut root_nodes = Vec::new();
    for dir in work_dirs {
        let name = dir.file_name().unwrap_or_default().to_string_lossy().to_string();
        let abs_path = dir.to_string_lossy().replace("\\", "/");
        let children = build_tree(&dir)?;
        root_nodes.push(FileNode {
            name,
            path: abs_path,
            node_type: "directory".to_string(),
            children: Some(children),
        });
    }
    Ok(root_nodes)
}

/// Reads the text content of a file from the disk.
#[tauri::command]
fn read_file(path: String, _state: State<'_, AppState>) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Writes new text content to a file on the disk.
#[tauri::command]
fn write_file(path: String, content: String, _state: State<'_, AppState>) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Represents the overall Git status for a specific repository workspace.
#[derive(Serialize, Deserialize)]
pub struct GitRepoStatus {
    /// The absolute path to the root of the git repository.
    repo_path: String,
    /// A list of all files in the repository that have changes (staged or unstaged).
    files: Vec<GitFile>,
}

/// Represents a single file's Git status.
#[derive(Serialize, Deserialize)]
pub struct GitFile {
    /// The relative path of the file from the git repository root.
    path: String,
    /// The status of the file in the Git index (staging area).
    index: String,
    /// The status of the file in the working directory.
    working_dir: String,
}

/// Invokes `git status` on all active workspace directories and parses the results.
#[tauri::command]
fn git_status(state: State<'_, AppState>) -> Result<Vec<GitRepoStatus>, String> {
    let work_dirs = state.work_dirs.lock().unwrap().clone();
    let mut all_statuses = Vec::new();

    for dir in work_dirs {
        let output = Command::new("git")
            .arg("status")
            .arg("--porcelain")
            .current_dir(&dir)
            .output();

        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut files = Vec::new();

                for line in stdout.lines() {
                    if line.len() > 3 {
                        let index = &line[0..1];
                        let working_dir = &line[1..2];
                        let path = &line[3..];
                        files.push(GitFile {
                            path: path.to_string(),
                            index: index.trim().to_string(),
                            working_dir: working_dir.trim().to_string(),
                        });
                    }
                }
                if !files.is_empty() {
                    all_statuses.push(GitRepoStatus {
                        repo_path: dir.to_string_lossy().replace("\\", "/"),
                        files,
                    });
                }
            }
        }
    }

    Ok(all_statuses)
}

/// Commits all current changes in a repository using a provided commit message.
#[tauri::command]
fn git_commit(repo_path: String, message: String) -> Result<(), String> {
    // git add .
    Command::new("git")
        .arg("add")
        .arg(".")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    // git commit -m message
    let output = Command::new("git")
        .arg("commit")
        .arg("-m")
        .arg(&message)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Retrieves the original (HEAD) content of a file from Git for diffing purposes.
#[tauri::command]
fn git_diff(repo_path: String, file_path: String) -> Result<String, String> {
    // Get the original content from git (HEAD version of the file)
    let output = Command::new("git")
        .arg("show")
        .arg(format!("HEAD:{}", file_path))
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        // If file is new, HEAD:file_path might fail. In that case, original content is empty.
        Ok(String::new())
    }
}

/// Retrieves all branches for a given repository.
#[tauri::command]
fn git_branches(repo_path: String) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .arg("branch")
        .arg("--format=%(refname:short)")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let branches = stdout.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
        Ok(branches)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Retrieves the current branch for a given repository.
#[tauri::command]
fn git_current_branch(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .arg("branch")
        .arg("--show-current")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Checks out a specific branch for a given repository.
#[tauri::command]
fn git_checkout(repo_path: String, branch: String) -> Result<(), String> {
    let output = Command::new("git")
        .arg("checkout")
        .arg(&branch)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Retrieves the list of currently active workspace directories.
#[tauri::command]
fn get_work_dirs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let work_dirs = state.work_dirs.lock().unwrap();
    Ok(work_dirs.iter().map(|p| p.to_string_lossy().replace("\\", "/")).collect())
}

/// Adds a new folder to the active workspace.
#[tauri::command]
fn add_folder(folder_path: String, state: State<'_, AppState>) -> Result<String, String> {
    let path = PathBuf::from(&folder_path);
    if path.is_dir() {
        let mut work_dirs = state.work_dirs.lock().unwrap();
        if !work_dirs.contains(&path) {
            work_dirs.push(path.clone());
        }
        Ok(path.to_string_lossy().replace("\\", "/"))
    } else {
        Err("Path is not a directory".to_string())
    }
}

/// Removes a folder from the active workspace.
#[tauri::command]
fn remove_folder(folder_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let path = PathBuf::from(&folder_path);
    let mut work_dirs = state.work_dirs.lock().unwrap();
    work_dirs.retain(|p| p != &path);
    Ok(())
}

/// Spawns a new terminal process.
#[tauri::command]
fn spawn_process(id: String, cmd: String, cwd: String, window: Window, state: State<'_, AppState>) -> Result<(), String> {
    let mut child = Command::new("cmd")
        .args(["/C", &cmd])
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;
    
    let id_clone1 = id.clone();
    let window_clone1 = window.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = window_clone1.emit(&format!("terminal-output-{}", id_clone1), format!("{}\r\n", l));
            }
        }
        let _ = window_clone1.emit(&format!("terminal-output-{}", id_clone1), "\r\n[Process Finished]\r\n");
    });

    let id_clone2 = id.clone();
    let window_clone2 = window.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = window_clone2.emit(&format!("terminal-output-{}", id_clone2), format!("{}\r\n", l));
            }
        }
    });

    let mut procs = state.processes.lock().unwrap();
    procs.insert(id, child);
    Ok(())
}

/// Writes input to a running terminal process.
#[tauri::command]
fn write_process(id: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut procs = state.processes.lock().unwrap();
    if let Some(child) = procs.get_mut(&id) {
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(data.as_bytes());
            let _ = stdin.flush();
        }
    }
    Ok(())
}

/// Kills a running terminal process.
#[tauri::command]
fn kill_process(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut procs = state.processes.lock().unwrap();
    if let Some(mut child) = procs.remove(&id) {
        let _ = child.kill();
    }
    Ok(())
}

/// Entry point for the Tauri application, registering state, plugins, and commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    
    tauri::Builder::default()
        .manage(AppState {
            work_dirs: Mutex::new(vec![initial_dir]),
            processes: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_files,
            read_file,
            write_file,
            git_status,
            git_commit,
            git_diff,
            git_branches,
            git_current_branch,
            git_checkout,
            get_work_dirs,
            add_folder,
            remove_folder,
            spawn_process,
            write_process,
            kill_process
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(not(debug_assertions))]
            {
                // Ensure log is still initialized or just skip it
            }
            app.handle().plugin(tauri_plugin_dialog::init())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

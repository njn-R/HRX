import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import EditorPane from './components/EditorPane';
import Terminal from './components/Terminal';
import type { ProjectConfig } from './components/ProjectRunner';
import { FileCode2, AlertCircle, X, TerminalSquare } from 'lucide-react';
import type { FileNode, ErrorMarker } from './types';
import { invoke } from '@tauri-apps/api/core';

/**
 * The main application component for the HRX IDE.
 * Manages the top-level state including the active file, workspace directories,
 * file tree, active theme settings, and error/problem markers.
 */
function App() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [workDirs, setWorkDirs] = useState<string[]>([]);
  
  const [autoSave, setAutoSave] = useState(false);
  const [errorLensEnabled, setErrorLensEnabled] = useState(true);
  
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminals' | 'problems'>('problems');
  const [markers, setMarkers] = useState<ErrorMarker[]>([]);
  const [activeTerminals, setActiveTerminals] = useState<ProjectConfig[]>([]);

  const [diffMode, setDiffMode] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  /**
   * Fetches the current list of workspace directories from the Tauri backend.
   */
  const fetchWorkDirs = useCallback(async () => {
    try {
      const dirs = await invoke<string[]>('get_work_dirs');
      setWorkDirs(dirs);
    } catch (error) {
      console.error('Failed to fetch work dirs:', error);
    }
  }, []);

  /**
   * Fetches the hierarchical file tree structure from the Tauri backend
   * for all currently loaded workspace directories.
   */
  const fetchFileTree = useCallback(async () => {
    try {
      const data = await invoke<FileNode[]>('get_files');
      setFileTree(data);
    } catch (error) {
      console.error('Failed to fetch file tree:', error);
    }
  }, []);

  useEffect(() => {
    fetchWorkDirs();
    fetchFileTree();
  }, [fetchWorkDirs, fetchFileTree]);

  /**
   * Handles user selection of a file from the sidebar.
   * Loads the file content from the backend and sets it as active.
   * 
   * @param path - The absolute path of the selected file.
   */
  const handleFileSelect = async (path: string) => {
    try {
      const content = await invoke<string>('read_file', { path });
      setActiveFile(path);
      setFileContent(content);
      setDiffMode(false);
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  };

  /**
   * Handles user selection of a file diff from the Git status panel.
   * Loads the original (HEAD) content and current content to display side-by-side.
   * 
   * @param repoPath - The absolute path to the root of the Git repository.
   * @param path - The relative path of the file within the repository.
   */
  const handleDiffSelect = async (repoPath: string, path: string) => {
    try {
      const original = await invoke<string>('git_diff', { repoPath, filePath: path });
      const separator = repoPath.includes('\\') ? '\\' : '/';
      const absolutePath = `${repoPath}${separator}${path}`;
      const content = await invoke<string>('read_file', { path: absolutePath });
      
      setActiveFile(absolutePath);
      setFileContent(content);
      setOriginalContent(original);
      setDiffMode(true);
    } catch (error) {
      console.error('Failed to load diff:', error);
    }
  };

  /**
   * Handles saving the content of the currently active file to the filesystem.
   * 
   * @param content - The new text content to save.
   */
  const handleFileSave = async (content: string) => {
    if (!activeFile) return;
    try {
      await invoke('write_file', { path: activeFile, content });
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  /**
   * Requests the backend to add a new folder to the active workspace.
   * Prompts a refresh of workspace directories and the file tree upon success.
   * 
   * @param folderPath - The absolute path of the folder to add.
   */
  const handleAddFolder = useCallback(async (folderPath: string) => {
    try {
      await invoke<string>('add_folder', { folderPath });
      fetchWorkDirs();
      fetchFileTree();
    } catch (error) {
      console.error('Failed to add folder:', error);
      alert(`Failed to add folder: ${error}`);
    }
  }, [fetchWorkDirs, fetchFileTree]);

  /**
   * Requests the backend to remove a folder from the active workspace.
   * Clears the active file if it belonged to the removed folder.
   * 
   * @param folderPath - The absolute path of the folder to remove.
   */
  const handleRemoveFolder = useCallback(async (folderPath: string) => {
    try {
      await invoke('remove_folder', { folderPath });
      if (activeFile && activeFile.startsWith(folderPath)) {
        setActiveFile(null);
      }
      fetchWorkDirs();
      fetchFileTree();
    } catch (error) {
      console.error('Failed to remove folder:', error);
    }
  }, [activeFile, fetchWorkDirs, fetchFileTree]);

  const handleStartProjects = (projects: ProjectConfig[]) => {
    setActiveTerminals(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const newProjs = projects.filter(p => !existingIds.has(p.id));
      return [...prev, ...newProjs];
    });
    setBottomPanelTab('terminals');
    setBottomPanelOpen(true);
  };

  return (
    <div className="flex h-screen bg-sidebar text-white overflow-hidden font-sans">
      <Sidebar 
        tree={fileTree} 
        onFileSelect={handleFileSelect} 
        onDiffSelect={handleDiffSelect}
        activeFile={activeFile} 
        onRefreshTree={fetchFileTree}
        workDirs={workDirs}
        onAddFolder={handleAddFolder}
        onRemoveFolder={handleRemoveFolder}
        onStartProjects={handleStartProjects}
      />
      <div className="flex-1 flex flex-col bg-editor min-w-0">
        <div className="h-10 bg-sidebar border-b border-white/5 flex items-center justify-end px-4 space-x-4">
          <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="rounded bg-black/50 border-white/20 text-accent focus:ring-accent" />
            <span>Auto Save</span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-gray-400 cursor-pointer hover:text-white transition-colors">
            <input type="checkbox" checked={errorLensEnabled} onChange={(e) => setErrorLensEnabled(e.target.checked)} className="rounded bg-black/50 border-white/20 text-accent focus:ring-accent" />
            <span>Error Lens</span>
          </label>
          <button 
            onClick={() => { setBottomPanelTab('problems'); setBottomPanelOpen(!bottomPanelOpen); }}
            className={`flex items-center space-x-1 text-xs transition-colors ${bottomPanelOpen && bottomPanelTab === 'problems' ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
          >
            <AlertCircle size={14} />
            <span>Problems ({markers.length})</span>
          </button>
          <button 
            onClick={() => { setBottomPanelTab('terminals'); setBottomPanelOpen(!bottomPanelOpen); }}
            className={`flex items-center space-x-1 text-xs transition-colors ${bottomPanelOpen && bottomPanelTab === 'terminals' ? 'text-accent' : 'text-gray-400 hover:text-white'}`}
          >
            <TerminalSquare size={14} />
            <span>Terminals ({activeTerminals.length})</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 relative">
          {activeFile ? (
            <EditorPane 
              filePath={activeFile} 
              content={fileContent} 
              onSave={handleFileSave}
              autoSave={autoSave}
              errorLensEnabled={errorLensEnabled}
              onMarkersUpdate={setMarkers}
              diffMode={diffMode}
              originalContent={originalContent}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <FileCode2 size={64} className="mb-4 opacity-50" />
              <h2 className="text-xl font-medium">Welcome to HRX IDE</h2>
              <p className="mt-2 text-sm">Select a file from the sidebar to start coding</p>
            </div>
          )}
          
          {bottomPanelOpen && (
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-sidebar border-t border-white/10 flex flex-col shadow-xl z-10">
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/5 bg-black/20">
                <div className="flex items-center space-x-6">
                  <button onClick={() => setBottomPanelTab('problems')} className={`text-xs font-medium flex items-center space-x-1.5 transition-colors ${bottomPanelTab === 'problems' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    <AlertCircle size={14} className={bottomPanelTab === 'problems' ? 'text-red-400' : ''} />
                    <span>Problems</span>
                  </button>
                  <button onClick={() => setBottomPanelTab('terminals')} className={`text-xs font-medium flex items-center space-x-1.5 transition-colors ${bottomPanelTab === 'terminals' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    <TerminalSquare size={14} className={bottomPanelTab === 'terminals' ? 'text-blue-400' : ''} />
                    <span>Terminals</span>
                  </button>
                </div>
                <button onClick={() => setBottomPanelOpen(false)} className="text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden relative">
                {bottomPanelTab === 'problems' && (
                  <div className="h-full overflow-y-auto p-2">
                    {markers.length === 0 ? (
                      <div className="text-xs text-gray-500 p-2 text-center mt-4">No problems found</div>
                    ) : (
                      <div className="space-y-1">
                        {markers.map((marker, i) => (
                          <div key={i} className="flex items-start space-x-3 text-xs p-2 hover:bg-white/5 rounded cursor-pointer">
                            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-gray-300">{marker.message}</div>
                              <div className="text-gray-500 mt-0.5">Line {marker.startLineNumber}, Column {marker.startColumn}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {bottomPanelTab === 'terminals' && (
                  <div className="h-full flex overflow-x-auto">
                    {activeTerminals.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-xs text-gray-500">No active terminals</div>
                    ) : (
                      activeTerminals.map(term => (
                        <div key={term.id} className="flex-1 min-w-[300px] border-r border-white/5 last:border-r-0 flex flex-col">
                          <div className="bg-black/40 px-3 py-1 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                            <div className="flex items-center space-x-2 truncate">
                              <span className="text-[10px] text-gray-400 font-mono truncate" title={term.command}>{term.command}</span>
                              <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 rounded">{term.path.split(/[\\/]/).pop()}</span>
                            </div>
                            <button onClick={() => setActiveTerminals(prev => prev.filter(t => t.id !== term.id))} className="text-gray-500 hover:text-red-400 ml-2">
                              <X size={12} />
                            </button>
                          </div>
                          <div className="flex-1 min-h-0 bg-[#0d1117]">
                            <Terminal 
                              id={term.id} 
                              command={term.command} 
                              cwd={term.path} 
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;


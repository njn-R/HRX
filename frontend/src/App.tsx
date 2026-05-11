import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import EditorPane from './components/EditorPane';
import { FileCode2 } from 'lucide-react';
import type { FileNode } from './types';

function App() {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [currentFolder, setCurrentFolder] = useState<string>('');

  const fetchCurrentFolder = useCallback(async () => {
    try {
      const res = await fetch('/api/current-folder');
      const data = await res.json();
      setCurrentFolder(data.path);
    } catch (error) {
      console.error('Failed to fetch current folder:', error);
    }
  }, []);

  const fetchFileTree = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFileTree(data);
    } catch (error) {
      console.error('Failed to fetch file tree:', error);
    }
  }, []);

  useEffect(() => {
    fetchCurrentFolder();
    fetchFileTree();
  }, [fetchCurrentFolder, fetchFileTree]);

  const handleFileSelect = async (path: string) => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      const content = await res.text();
      setActiveFile(path);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  };

  const handleFileSave = async (content: string) => {
    if (!activeFile) return;
    try {
      await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFile, content })
      });
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const handleOpenFolder = useCallback(async (folderPath: string) => {
    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentFolder(data.path);
        setActiveFile(null);
        setFileContent('');
        fetchFileTree();
      } else {
        alert(`Failed to open folder: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      alert('Failed to open folder. Make sure the path exists.');
    }
  }, [fetchFileTree]);

  return (
    <div className="flex h-screen bg-sidebar text-white overflow-hidden font-sans">
      <Sidebar 
        tree={fileTree} 
        onFileSelect={handleFileSelect} 
        activeFile={activeFile} 
        onRefreshTree={fetchFileTree}
        currentFolder={currentFolder}
        onOpenFolder={handleOpenFolder}
      />
      <div className="flex-1 flex flex-col bg-editor">
        {activeFile ? (
          <EditorPane 
            filePath={activeFile} 
            content={fileContent} 
            onSave={handleFileSave} 
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <FileCode2 size={64} className="mb-4 opacity-50" />
            <h2 className="text-xl font-medium">Welcome to HRX IDE</h2>
            <p className="mt-2 text-sm">Select a file from the sidebar to start coding</p>
            {currentFolder && (
              <p className="mt-1 text-xs text-gray-600 font-mono">{currentFolder}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;


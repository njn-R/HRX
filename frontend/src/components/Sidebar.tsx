import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, GitBranch, Files, FolderOpen } from 'lucide-react';
import type { FileNode } from '../types';
import GitStatus from './GitStatus';

interface SidebarProps {
  tree: FileNode[];
  onFileSelect: (path: string) => void;
  activeFile: string | null;
  onRefreshTree: () => void;
  currentFolder: string;
  onOpenFolder: (path: string) => void;
}

const FileTreeNode = ({ 
  node, 
  onSelect, 
  activeFile, 
  level = 0 
}: { 
  node: FileNode; 
  onSelect: (path: string) => void;
  activeFile: string | null;
  level?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isDir = node.type === 'directory';
  const isActive = activeFile === node.path;

  const handleClick = () => {
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-white/5 transition-colors ${isActive ? 'bg-accent/20 text-accent' : 'text-gray-300'}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          isOpen ? <ChevronDown size={14} className="mr-1 opacity-70" /> : <ChevronRight size={14} className="mr-1 opacity-70" />
        ) : (
          <span className="w-3.5 mr-1 inline-block" />
        )}
        
        {isDir ? (
          <Folder size={14} className="mr-2 text-blue-400" />
        ) : (
          <File size={14} className="mr-2 opacity-70" />
        )}
        
        <span className="text-sm truncate select-none">{node.name}</span>
      </div>
      
      {isDir && isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeNode 
              key={child.path} 
              node={child} 
              onSelect={onSelect} 
              activeFile={activeFile}
              level={level + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Sidebar({ tree, onFileSelect, activeFile, onRefreshTree, currentFolder, onOpenFolder }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'git'>('files');
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderPath, setFolderPath] = useState('');

  const folderName = currentFolder ? currentFolder.split('\\').pop() || currentFolder.split('/').pop() || currentFolder : 'No folder';

  const handleOpenFolder = () => {
    if (folderPath.trim()) {
      onOpenFolder(folderPath.trim());
      setFolderPath('');
      setShowFolderInput(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOpenFolder();
    } else if (e.key === 'Escape') {
      setShowFolderInput(false);
      setFolderPath('');
    }
  };

  return (
    <div className="w-64 bg-sidebar border-r border-white/10 flex flex-col h-full flex-shrink-0">
      <div className="flex items-center justify-start p-2 border-b border-white/10 space-x-1">
        <button 
          onClick={() => setActiveTab('files')}
          className={`p-2 rounded flex items-center justify-center transition-colors ${activeTab === 'files' ? 'text-accent bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          title="Explorer"
        >
          <Files size={18} />
        </button>
        <button 
          onClick={() => setActiveTab('git')}
          className={`p-2 rounded flex items-center justify-center transition-colors ${activeTab === 'git' ? 'text-accent bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
          title="Source Control"
        >
          <GitBranch size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {activeTab === 'files' && (
          <div>
            <div className="px-4 py-1 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <span className="truncate" title={currentFolder}>{folderName}</span>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button 
                  onClick={() => setShowFolderInput(!showFolderInput)} 
                  className="hover:text-white transition-colors" 
                  title="Open Folder"
                >
                  <FolderOpen size={14} />
                </button>
                <button onClick={onRefreshTree} className="hover:text-white transition-colors" title="Refresh">⟳</button>
              </div>
            </div>

            {showFolderInput && (
              <div className="px-3 mb-3">
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter folder path..."
                  className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-accent font-mono"
                  autoFocus
                />
                <div className="flex space-x-1 mt-1">
                  <button
                    onClick={handleOpenFolder}
                    className="flex-1 bg-accent text-white text-xs py-1 rounded hover:bg-accent-hover transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => { setShowFolderInput(false); setFolderPath(''); }}
                    className="flex-1 bg-white/5 text-gray-400 text-xs py-1 rounded hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {tree.map(node => (
              <FileTreeNode 
                key={node.path} 
                node={node} 
                onSelect={onFileSelect} 
                activeFile={activeFile} 
              />
            ))}
          </div>
        )}
        
        {activeTab === 'git' && (
          <GitStatus />
        )}
      </div>
    </div>
  );
}


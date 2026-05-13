import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, GitBranch, Files, FolderPlus, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import type { FileNode } from '../types';
import GitStatus from './GitStatus';

/**
 * Props for the Sidebar component.
 */
interface SidebarProps {
  tree: FileNode[];
  onFileSelect: (path: string) => void;
  onDiffSelect: (repoPath: string, path: string) => void;
  activeFile: string | null;
  onRefreshTree: () => void;
  workDirs: string[];
  onAddFolder: (path: string) => void;
  onRemoveFolder: (path: string) => void;
}

/**
 * Renders a single node (file or directory) in the file tree recursively.
 * 
 * @param node - The current file or directory node to render.
 * @param onSelect - Callback when a file is clicked.
 * @param activeFile - The path of the currently active file for highlighting.
 * @param level - The depth level of this node (used for indentation).
 * @param onRemoveRoot - Optional callback to remove a root workspace folder.
 */
const FileTreeNode = ({ 
  node, 
  onSelect, 
  activeFile, 
  level = 0,
  onRemoveRoot
}: { 
  node: FileNode; 
  onSelect: (path: string) => void;
  activeFile: string | null;
  level?: number;
  onRemoveRoot?: (path: string) => void;
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
        className={`group flex items-center py-1 px-2 cursor-pointer hover:bg-white/5 transition-colors ${isActive ? 'bg-accent/20 text-accent' : 'text-gray-300'}`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          isOpen ? <ChevronDown size={14} className="mr-1 opacity-70 flex-shrink-0" /> : <ChevronRight size={14} className="mr-1 opacity-70 flex-shrink-0" />
        ) : (
          <span className="w-3.5 mr-1 inline-block flex-shrink-0" />
        )}
        
        {isDir ? (
          <Folder size={14} className="mr-2 text-blue-400 flex-shrink-0" />
        ) : (
          <File size={14} className="mr-2 opacity-70 flex-shrink-0" />
        )}
        
        <span className="text-sm truncate select-none flex-1">{node.name}</span>

        {level === 0 && onRemoveRoot && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRemoveRoot(node.path); }}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-0.5 ml-1 flex-shrink-0"
            title="Remove Folder"
          >
            <X size={12} />
          </button>
        )}
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
              onRemoveRoot={onRemoveRoot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The sidebar navigation component.
 * Contains tabs for the File Explorer and Source Control (Git).
 * Manages the rendering of the workspace file tree and Git status.
 */
export default function Sidebar({ tree, onFileSelect, onDiffSelect, activeFile, onRefreshTree, workDirs, onAddFolder, onRemoveFolder }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'git'>('files');

  const handleAddFolderClick = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        onAddFolder(selected);
      }
    } catch (error) {
      console.error('Failed to open dialog:', error);
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
              <span>Explorer</span>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button 
                  onClick={handleAddFolderClick} 
                  className="hover:text-white transition-colors" 
                  title="Add Folder to Workspace"
                >
                  <FolderPlus size={14} />
                </button>
                <button onClick={onRefreshTree} className="hover:text-white transition-colors" title="Refresh">⟳</button>
              </div>
            </div>

            {tree.map(node => (
              <FileTreeNode 
                key={node.path} 
                node={node} 
                onSelect={onFileSelect} 
                activeFile={activeFile} 
                onRemoveRoot={onRemoveFolder}
              />
            ))}
          </div>
        )}
        
        {activeTab === 'git' && (
          <GitStatus workDirs={workDirs} onDiffSelect={onDiffSelect} />
        )}
      </div>
    </div>
  );
}


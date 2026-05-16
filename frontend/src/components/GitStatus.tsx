import { useState, useEffect } from 'react';
import { Check, Loader2, GitBranch } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { GitRepoStatus } from '../types';

/**
 * Props for the GitStatus component.
 */
interface GitStatusProps {
  workDirs: string[];
  onDiffSelect: (repoPath: string, path: string) => void;
}

/**
 * A component that displays the Git status of all active workspace repositories.
 * It allows the user to view changed files, see diffs, and commit changes.
 */
export default function GitStatus({ workDirs, onDiffSelect }: GitStatusProps) {
  const [statuses, setStatuses] = useState<GitRepoStatus[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [branches, setBranches] = useState<Record<string, string[]>>({});
  const [currentBranch, setCurrentBranch] = useState<Record<string, string>>({});

  /**
   * Fetches the current git status for all workspace directories from the backend.
   */
  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const data = await invoke<GitRepoStatus[]>('git_status');
      setStatuses(data);

      const newBranches: Record<string, string[]> = {};
      const newCurrentBranch: Record<string, string> = {};
      
      for (const dir of workDirs) {
        try {
          const b = await invoke<string[]>('git_branches', { repoPath: dir });
          const curr = await invoke<string>('git_current_branch', { repoPath: dir });
          newBranches[dir] = b;
          newCurrentBranch[dir] = curr;
        } catch (e) {
          console.error(`Failed to fetch branches for ${dir}`, e);
        }
      }
      setBranches(newBranches);
      setCurrentBranch(newCurrentBranch);
    } catch (error) {
      console.error('Failed to fetch git status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [workDirs]);

  /**
   * Handles committing changes for a specific repository.
   * Prompts the backend to execute git add . and git commit -m <message>.
   * 
   * @param repoPath - The absolute path to the git repository to commit.
   */
  const handleCommit = async (repoPath: string) => {
    const msg = messages[repoPath];
    if (!msg?.trim()) return;
    setLoading(prev => ({ ...prev, [repoPath]: true }));
    try {
      await invoke('git_commit', { repoPath, message: msg });
      setMessages(prev => ({ ...prev, [repoPath]: '' }));
      fetchStatus();
    } catch (error) {
      console.error('Commit failed:', error);
      alert(`Commit failed: ${error}`);
    } finally {
      setLoading(prev => ({ ...prev, [repoPath]: false }));
    }
  };

  const handleBranchChange = async (repoPath: string, branch: string) => {
    try {
      await invoke('git_checkout', { repoPath, branch });
      fetchStatus();
    } catch (error) {
      console.error('Failed to checkout branch:', error);
      alert(`Checkout failed: ${error}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-1 flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        <span>Source Control</span>
        <button 
          onClick={fetchStatus} 
          className={`hover:text-white transition-colors ${refreshing ? 'animate-spin' : ''}`}
        >
          ⟳
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-4">
        {statuses.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            No changes
          </div>
        ) : (
          statuses.map((repoStatus, idx) => {
            const folderName = repoStatus.repo_path.split('/').pop() || repoStatus.repo_path.split('\\').pop() || repoStatus.repo_path;
            const msg = messages[repoStatus.repo_path] || '';
            const isLoading = loading[repoStatus.repo_path] || false;
            
            return (
              <div key={idx} className="bg-black/10 rounded p-2 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-gray-400 truncate" title={repoStatus.repo_path}>
                    {folderName}
                  </div>
                  {branches[repoStatus.repo_path] && (
                    <div className="flex items-center space-x-1 text-[10px] bg-black/30 rounded px-1.5 py-0.5 border border-white/5">
                      <GitBranch size={10} className="text-gray-400" />
                      <select 
                        value={currentBranch[repoStatus.repo_path] || ''} 
                        onChange={(e) => handleBranchChange(repoStatus.repo_path, e.target.value)}
                        className="bg-transparent text-gray-300 focus:outline-none cursor-pointer max-w-[80px]"
                      >
                        {branches[repoStatus.repo_path].map(b => (
                          <option key={b} value={b} className="bg-[#1e1e1e]">{b}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="mb-3">
                  <textarea
                    value={msg}
                    onChange={(e) => setMessages(prev => ({ ...prev, [repoStatus.repo_path]: e.target.value }))}
                    placeholder="Commit message..."
                    className="w-full bg-black/20 border border-white/10 rounded p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none min-h-[60px]"
                  />
                  <button
                    onClick={() => handleCommit(repoStatus.repo_path)}
                    disabled={!msg.trim() || isLoading}
                    className="mt-2 w-full flex items-center justify-center py-1 px-3 bg-accent/80 text-white rounded text-xs font-medium hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} className="mr-1" /> Commit</>}
                  </button>
                </div>

                <div className="space-y-1">
                  {repoStatus.files.map((file, fIdx) => (
                    <div 
                      key={fIdx} 
                      className="flex items-center text-sm py-1 cursor-pointer hover:bg-white/5 rounded px-1"
                      onClick={() => onDiffSelect(repoStatus.repo_path, file.path)}
                    >
                      <span className={`w-4 text-center mr-2 text-[10px] font-mono ${file.working_dir === 'M' || file.index === 'M' ? 'text-blue-400' : 'text-green-400'}`}>
                        {file.working_dir || file.index}
                      </span>
                      <span className="text-gray-300 truncate text-xs">{file.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

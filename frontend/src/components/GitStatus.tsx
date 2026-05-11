import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface GitStatusData {
  files: Array<{ path: string; index: string; working_dir: string }>;
}

export default function GitStatus() {
  const [status, setStatus] = useState<GitStatusData | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/git/status');
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch git status:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCommit = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      setMessage('');
      fetchStatus();
    } catch (error) {
      console.error('Commit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = status?.files && status.files.length > 0;

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

      <div className="px-3 mb-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message..."
          className="w-full bg-black/20 border border-white/10 rounded p-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none min-h-[80px]"
        />
        <button
          onClick={handleCommit}
          disabled={!hasChanges || !message.trim() || loading}
          className="mt-2 w-full flex items-center justify-center py-1.5 px-3 bg-accent text-white rounded text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} className="mr-1" /> Commit</>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        {hasChanges ? (
          <div className="space-y-1">
            {status.files.map((file, idx) => (
              <div key={idx} className="flex items-center text-sm py-1">
                <span className={`w-4 text-center mr-2 text-xs font-mono ${file.working_dir === 'M' || file.index === 'M' ? 'text-blue-400' : 'text-green-400'}`}>
                  {file.working_dir || file.index}
                </span>
                <span className="text-gray-300 truncate">{file.path}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm mt-8">
            No changes
          </div>
        )}
      </div>
    </div>
  );
}

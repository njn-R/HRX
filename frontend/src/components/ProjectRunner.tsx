import { useState, useEffect } from 'react';
import { Play, Plus, Folder, Trash2, CheckSquare, Square } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export interface ProjectConfig {
  id: string;
  path: string;
  command: string;
  selected: boolean;
}

interface ProjectRunnerProps {
  onStartProjects: (projects: ProjectConfig[]) => void;
}

export default function ProjectRunner({ onStartProjects }: ProjectRunnerProps) {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('hrx_projects');
    if (saved) {
      try {
        setProjects(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const saveProjects = (newProjects: ProjectConfig[]) => {
    setProjects(newProjects);
    localStorage.setItem('hrx_projects', JSON.stringify(newProjects));
  };

  const handleAddProject = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        const newProj: ProjectConfig = {
          id: Math.random().toString(36).substring(7),
          path: selected,
          command: 'npm run dev',
          selected: true
        };
        saveProjects([...projects, newProj]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateProject = (id: string, updates: Partial<ProjectConfig>) => {
    saveProjects(projects.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProject = (id: string) => {
    saveProjects(projects.filter(p => p.id !== id));
  };

  const handleStartSelected = () => {
    const toStart = projects.filter(p => p.selected);
    if (toStart.length > 0) {
      onStartProjects(toStart);
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-white/5 w-72 flex-shrink-0">
      <div className="p-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Project Runner</h3>
        <div className="flex space-x-2">
          <button onClick={handleAddProject} className="flex items-center justify-center w-6 h-6 bg-white/5 hover:bg-white/10 rounded text-gray-300 transition-colors" title="Add Repo">
            <Plus size={14} />
          </button>
          <button onClick={handleStartSelected} disabled={!projects.some(p => p.selected)} className="flex items-center space-x-1 px-2 py-1 bg-accent/80 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs text-white transition-colors">
            <Play size={12} />
            <span>Start</span>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {projects.length === 0 ? (
          <div className="text-center text-xs text-gray-500 mt-4">
            No projects added. Click + to add.
          </div>
        ) : (
          projects.map(p => (
            <div key={p.id} className="flex flex-col bg-black/20 p-2 rounded border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <button onClick={() => updateProject(p.id, { selected: !p.selected })} className="text-gray-400 hover:text-white flex-shrink-0">
                    {p.selected ? <CheckSquare size={14} className="text-accent" /> : <Square size={14} />}
                  </button>
                  <Folder size={12} className="text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-gray-300 truncate" title={p.path}>{p.path.split(/[\\/]/).pop()}</span>
                </div>
                <button onClick={() => removeProject(p.id)} className="text-gray-500 hover:text-red-400 p-0.5 flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
              <input 
                type="text" 
                value={p.command} 
                onChange={(e) => updateProject(p.id, { command: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-accent"
                placeholder="npm run dev"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

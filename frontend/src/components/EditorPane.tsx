import { useRef, useEffect, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import { Save } from 'lucide-react';

interface EditorPaneProps {
  filePath: string;
  content: string;
  onSave: (content: string) => void;
}

export default function EditorPane({ filePath, content, onSave }: EditorPaneProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [currentContent, setCurrentContent] = useState(content);
  const [decorations, setDecorations] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update editor content when active file changes
  useEffect(() => {
    setCurrentContent(content);
    setHasUnsavedChanges(false);
  }, [filePath, content]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Premium dark theme configuration
    monaco.editor.defineTheme('premiumDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { background: '1e1e24' }
      ],
      colors: {
        'editor.background': '#1e1e24',
        'editor.lineHighlightBackground': '#2a2a32',
        'editorLineNumber.foreground': '#6b7280',
        'editorIndentGuide.background': '#374151',
      }
    });
    monaco.editor.setTheme('premiumDark');

    // Error Lens Implementation
    const updateErrorLens = () => {
      const model = editor.getModel();
      if (!model) return;
      
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      
      const newDecorations = markers.map(marker => {
        return {
          range: new monaco.Range(marker.startLineNumber, 1, marker.startLineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'error-lens-decoration',
            after: {
              content: `    ${marker.message}`,
              inlineClassName: 'error-lens-message'
            }
          }
        };
      });

      setDecorations(prev => editor.deltaDecorations(prev, newDecorations));
    };

    // Listen for marker changes (diagnostics/errors)
    const disposable = monaco.editor.onDidChangeMarkers(updateErrorLens);
    
    // Initial check
    updateErrorLens();

    // Add Save shortcut (Ctrl/Cmd + S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave(editor.getValue());
      setHasUnsavedChanges(false);
    });

    return () => {
      disposable.dispose();
    };
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCurrentContent(value);
      setHasUnsavedChanges(value !== content);
    }
  };

  // Determine language based on file extension
  const getLanguage = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.md')) return 'markdown';
    return 'plaintext';
  };

  return (
    <div className="flex flex-col h-full bg-editor">
      <div className="flex items-center justify-between px-4 py-2 bg-sidebar border-b border-white/5">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-300">
            {filePath.split('\\').pop() || filePath.split('/').pop()}
          </span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
          )}
        </div>
        <button 
          onClick={() => {
            onSave(currentContent);
            setHasUnsavedChanges(false);
          }}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${hasUnsavedChanges ? 'bg-accent text-white hover:bg-accent-hover' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Save size={14} />
          <span>Save</span>
        </button>
      </div>
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={getLanguage(filePath)}
          theme="premiumDark"
          value={currentContent}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            wordWrap: 'on',
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            formatOnPaste: true,
          }}
        />
      </div>
    </div>
  );
}

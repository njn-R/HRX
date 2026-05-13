import { useRef, useEffect, useState } from 'react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { Save } from 'lucide-react';
import type { ErrorMarker } from '../types';

/**
 * Props for the EditorPane component.
 */
interface EditorPaneProps {
  /** The absolute path of the file currently being edited */
  filePath: string;
  /** The text content of the file */
  content: string;
  /** Callback triggered when the user saves the file (manually or via auto-save) */
  onSave: (content: string) => void;
  /** Whether auto-save is enabled (saves after a short delay on typing) */
  autoSave?: boolean;
  /** Whether the inline error lens (diagnostics) feature is enabled */
  errorLensEnabled?: boolean;
  /** Callback triggered when the editor's error markers (diagnostics) update */
  onMarkersUpdate?: (markers: ErrorMarker[]) => void;
  /** Whether the editor is in diff mode (showing original vs current content) */
  diffMode?: boolean;
  /** The original content of the file, used only when diffMode is true */
  originalContent?: string;
}

/**
 * The main editor pane utilizing Monaco Editor.
 * Supports standard text editing, auto-save functionality, error lens integration,
 * and a side-by-side diff mode.
 */
export default function EditorPane({ 
  filePath, 
  content, 
  onSave,
  autoSave = false,
  errorLensEnabled = true,
  onMarkersUpdate,
  diffMode = false,
  originalContent = ''
}: EditorPaneProps) {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [currentContent, setCurrentContent] = useState(content);
  const [, setDecorations] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update editor content when active file changes
  useEffect(() => {
    setCurrentContent(content);
    setHasUnsavedChanges(false);
  }, [filePath, content]);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCurrentContent(value);
      setHasUnsavedChanges(value !== content);
      
      if (autoSave) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
          onSave(value);
          setHasUnsavedChanges(false);
        }, 1000);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const handleEditorMount = (editor: any, monaco: any) => {
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

    const updateErrorLens = () => {
      let actualModel;
      let targetEditor = editor;
      if (diffMode) {
        targetEditor = editor.getModifiedEditor();
        actualModel = targetEditor.getModel();
      } else {
        actualModel = editor.getModel();
      }
      
      if (!actualModel) return;
      
      const markers = monaco.editor.getModelMarkers({ resource: actualModel.uri });
      
      if (onMarkersUpdate) {
        onMarkersUpdate(markers);
      }

      if (!errorLensEnabled) {
        setDecorations(prev => targetEditor.deltaDecorations(prev, []));
        return;
      }
      
      const newDecorations = markers.map((marker: any) => {
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

      setDecorations(prev => targetEditor.deltaDecorations(prev, newDecorations));
    };

    const disposable = monaco.editor.onDidChangeMarkers(updateErrorLens);
    updateErrorLens();

    // Add Save shortcut (Ctrl/Cmd + S)
    const activeEditor = diffMode ? editor.getModifiedEditor() : editor;
    activeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave(activeEditor.getValue());
      setHasUnsavedChanges(false);
    });

    // Also handle changes for diff editor since it doesn't have onChange prop in some wrappers
    if (diffMode) {
      const activeModel = activeEditor.getModel();
      activeModel.onDidChangeContent(() => {
        handleChange(activeEditor.getValue());
      });
    }

    return () => {
      disposable.dispose();
    };
  };

  useEffect(() => {
    if (editorRef.current && monaco) {
      if (!errorLensEnabled) {
        const targetEditor = diffMode ? editorRef.current.getModifiedEditor() : editorRef.current;
        if (targetEditor) {
          setDecorations(prev => targetEditor.deltaDecorations(prev, []));
        }
      }
    }
  }, [errorLensEnabled, diffMode, monaco]);

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
        {diffMode ? (
          <DiffEditor
            height="100%"
            language={getLanguage(filePath)}
            theme="premiumDark"
            original={originalContent}
            modified={currentContent}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              wordWrap: 'on',
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              renderSideBySide: true,
            }}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}

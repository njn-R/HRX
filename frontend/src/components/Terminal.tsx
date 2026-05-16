import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  id: string;
  command: string;
  cwd: string;
  onExit?: () => void;
}

export default function Terminal({ id, command, cwd, onExit }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0d1117', // Match the IDE dark theme
        foreground: '#c9d1d9',
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Slight delay to ensure parent container is sized
    setTimeout(() => fitAddon.fit(), 50);
    
    xtermRef.current = term;

    let unlisten: (() => void) | undefined;

    const initProcess = async () => {
      try {
        term.write(`\x1b[32m$ ${command}\x1b[0m\r\n`);
        
        unlisten = await listen<string>(`terminal-output-${id}`, (event) => {
          if (event.payload === '\r\n[Process Finished]\r\n') {
             term.write(event.payload);
             if (onExit) onExit();
          } else {
             // stdout from cmd.exe might already have \r\n, but just in case
             term.write(event.payload);
          }
        });

        await invoke('spawn_process', { id, cmd: command, cwd });

        term.onData(async (data) => {
          await invoke('write_process', { id, data });
        });
      } catch (err) {
        term.write(`\r\n\x1b[31mError starting process:\x1b[0m ${err}\r\n`);
      }
    };

    initProcess();

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Ignore fit errors on resize
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      if (unlisten) unlisten();
      invoke('kill_process', { id }).catch(console.error);
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [id, command, cwd, onExit]);

  return <div ref={terminalRef} className="w-full h-full overflow-hidden p-2" />;
}

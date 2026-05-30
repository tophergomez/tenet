import { useEffect, useCallback } from 'react'
import { FolderOpen } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TerminalPane } from '../components/terminal/TerminalPane'
import { TabBar } from '../components/terminal/TabBar'
import { SessionList } from '../components/terminal/SessionList'
import { DirectoryPicker } from '../components/terminal/DirectoryPicker'
import { useTerminalStore, type ShellType, type SavedSession } from '../store/terminal'
import { TerminalCreate, TerminalClose, TerminalAvailableShells, TerminalInjectHistory, SessionTouch, SessionUpdateDir } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { useState } from 'react'

export function TerminalPage() {
  const { tabs, activeTabId, addTab, removeTab, setShells, updateLastSaved } = useTerminalStore()
  const [dirPickerOpen, setDirPickerOpen] = useState(false)
  const [pendingShell, setPendingShell] = useState<ShellType | null>(null)

  // Load available shells once
  useEffect(() => {
    TerminalAvailableShells()
      .then((shells) => setShells(shells as ShellType[]))
      .catch(() => {})
  }, [setShells])

  const spawnTab = useCallback(
    async (shell: ShellType, workingDir = '', sessionId?: string, color?: string) => {
      try {
        const id = await TerminalCreate(shell, workingDir)
        addTab({
          id,
          title: shell,
          shell,
          workingDir,
          sessionId,
          isAlive: true,
          color,
        })
        // Inject saved command history so the user can ↑ through previous commands.
        // Delayed to let the shell finish its startup phase before we write to the PTY.
        if (sessionId) {
          setTimeout(() => TerminalInjectHistory(id, sessionId).catch(() => {}), 900)
        }
      } catch (e) {
        console.error('spawn failed:', e)
      }
    },
    [addTab]
  )

  // Open first tab on mount
  useEffect(() => {
    if (tabs.length === 0) {
      spawnTab('powershell')
    }
  }, []) // intentionally runs once

  // Listen for OS-level close
  useEffect(() => {
    const unsub = EventsOn('auth:logout', () => {})
    return () => unsub()
  }, [])

  // Auto-save linked sessions every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const { tabs } = useTerminalStore.getState()
      tabs.forEach((tab) => {
        if (tab.sessionId && tab.isAlive) {
          const now = new Date().toISOString()
          SessionTouch(tab.sessionId).catch(() => {})
          SessionUpdateDir(tab.sessionId, tab.workingDir).catch(() => {})
          updateLastSaved(tab.id, now)
        }
      })
    }, 10_000)
    return () => clearInterval(interval)
  }, [updateLastSaved])

  const handleNewTab = (shell: ShellType) => {
    setPendingShell(shell)
    setDirPickerOpen(true)
  }

  const handleDirSelected = (path: string) => {
    if (pendingShell) {
      spawnTab(pendingShell, path)
      setPendingShell(null)
    }
  }

  const handleDirPickerClose = () => {
    // User cancelled directory — spawn without dir
    if (pendingShell) {
      spawnTab(pendingShell, '')
      setPendingShell(null)
    }
    setDirPickerOpen(false)
  }

  const handleCloseTab = (termID: string) => {
    TerminalClose(termID)
    removeTab(termID)
  }

  const handleOpenSession = (session: SavedSession) => {
    const color = localStorage.getItem(`tenet:session-color:${session.id}`) ?? undefined
    spawnTab(session.shell as ShellType, session.working_dir, session.id, color)
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen w-screen bg-zinc-950 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center h-10 bg-zinc-950 border-b border-zinc-800 px-3 shrink-0 select-none">
          {/* App name */}
          <span className="font-mono text-xs font-bold text-zinc-400 tracking-widest mr-4">
            TENET
          </span>

          {/* Active dir */}
          {activeTab && (
            <button
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-mono max-w-xs truncate"
              onClick={() => {
                setPendingShell(activeTab.shell)
                setDirPickerOpen(true)
              }}
              title="Change directory"
            >
              <FolderOpen size={12} />
              <span className="truncate">
                {activeTab.workingDir || '~'}
              </span>
            </button>
          )}
        </div>

        {/* Tab bar */}
        <TabBar onNewTab={handleNewTab} onCloseTab={handleCloseTab} />

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Session sidebar */}
          <SessionList onOpenSession={handleOpenSession} />

          {/* Terminal panes */}
          <div className="flex-1 overflow-hidden relative bg-zinc-950">
            {tabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-3">
                <span className="text-4xl font-mono font-bold tracking-widest">TENET</span>
                <p className="text-sm">Click + to open a new terminal</p>
              </div>
            ) : (
              tabs.map((tab) => (
                <div
                  key={tab.id}
                  className="absolute inset-0"
                  style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
                >
                  <TerminalPane termID={tab.id} isActive={tab.id === activeTabId} />
                </div>
              ))
            )}
          </div>
        </div>

        <DirectoryPicker
          open={dirPickerOpen}
          onSelect={(path) => {
            if (pendingShell) {
              handleDirSelected(path)
            }
            setDirPickerOpen(false)
          }}
          onClose={handleDirPickerClose}
        />
      </div>
    </TooltipProvider>
  )
}

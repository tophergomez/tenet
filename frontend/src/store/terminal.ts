import { create } from 'zustand'

export type ShellType = 'bash' | 'powershell' | 'cmd'

export interface Tab {
  id: string         // Wails terminal process ID
  title: string
  shell: ShellType
  workingDir: string
  sessionId?: string // linked saved-session ID
  isAlive: boolean
}

export interface SavedSession {
  id: string
  name: string
  shell: string
  working_dir: string
  created_at: string
  last_used_at: string
}

interface TerminalState {
  tabs: Tab[]
  activeTabId: string | null
  sessions: SavedSession[]
  availableShells: ShellType[]

  addTab: (tab: Tab) => void
  removeTab: (id: string) => void
  setActive: (id: string) => void
  markDead: (id: string) => void
  updateTitle: (id: string, title: string) => void
  updateWorkingDir: (id: string, dir: string) => void
  setSessions: (s: SavedSession[]) => void
  setShells: (shells: ShellType[]) => void
}

export const useTerminalStore = create<TerminalState>((set) => ({
  tabs: [],
  activeTabId: null,
  sessions: [],
  availableShells: ['powershell', 'cmd'],

  addTab: (tab) =>
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id })),

  removeTab: (id) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.id !== id)
      const activeTabId =
        s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId
      return { tabs, activeTabId }
    }),

  setActive: (id) => set({ activeTabId: id }),

  markDead: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isAlive: false } : t)),
    })),

  updateTitle: (id, title) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
    })),

  updateWorkingDir: (id, workingDir) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, workingDir } : t)),
    })),

  setSessions: (sessions) => set({ sessions }),

  setShells: (availableShells) => set({ availableShells }),
}))

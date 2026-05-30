import { create } from 'zustand'

export type ShellType = 'bash' | 'powershell' | 'cmd'

export const TAB_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
] as const

export interface Tab {
  id: string         // Wails terminal process ID
  title: string
  shell: ShellType
  workingDir: string
  sessionId?: string // linked saved-session ID
  isAlive: boolean
  lastSavedAt?: string // ISO timestamp of last auto-save
  color?: string       // accent color hex
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
  updateLastSaved: (id: string, timestamp: string) => void
  updateTabColor: (id: string, color: string) => void
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

  updateLastSaved: (id, timestamp) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, lastSavedAt: timestamp } : t)),
    })),

  updateTabColor: (id, color) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, color } : t)),
    })),
}))

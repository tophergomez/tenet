import { useState, useEffect } from 'react'
import { Plus, Terminal, Trash2, Pencil, ChevronRight, Clock, Palette } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTerminalStore, type SavedSession, TAB_COLORS } from '../../store/terminal'
import { useAuthStore } from '../../store/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  SessionList as FetchSessions,
  SessionCreate,
  SessionDelete,
  SessionRename,
  SessionTouch,
  AuthLogout,
} from '../../../wailsjs/go/main/App'

interface SessionListProps {
  onOpenSession: (session: SavedSession) => void
}

export function SessionList({ onOpenSession }: SessionListProps) {
  const { sessions, setSessions, tabs, activeTabId } = useTerminalStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const { user, logout } = useAuthStore()
  const [newName, setNewName] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [sessionColors, setSessionColors] = useState<Record<string, string>>(() => {
    const stored: Record<string, string> = {}
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tenet:session-color:')) {
        const id = key.slice('tenet:session-color:'.length)
        stored[id] = localStorage.getItem(key) ?? ''
      }
    }
    return stored
  })

  const handleSessionColor = (sessionId: string, color: string) => {
    if (color) {
      localStorage.setItem(`tenet:session-color:${sessionId}`, color)
    } else {
      localStorage.removeItem(`tenet:session-color:${sessionId}`)
    }
    setSessionColors((prev) => ({ ...prev, [sessionId]: color }))
  }

  // Load saved sessions on mount
  useEffect(() => {
    FetchSessions()
      .then((s) => setSessions(s ?? []))
      .catch(() => {})
  }, [setSessions])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const shell = activeTab?.shell ?? 'powershell'
      const workingDir = activeTab?.workingDir ?? ''
      const s = await SessionCreate(newName.trim(), shell, workingDir)
      if (s) setSessions([s, ...sessions])
      setNewName('')
      setCreateOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await SessionDelete(id)
      setSessions(sessions.filter((s) => s.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleRename = async () => {
    if (!renameId || !renameName.trim()) return
    try {
      await SessionRename(renameId, renameName.trim())
      setSessions(sessions.map((s) => (s.id === renameId ? { ...s, name: renameName.trim() } : s)))
    } catch (e) {
      console.error(e)
    } finally {
      setRenameId(null)
    }
  }

  const handleLogout = () => {
    AuthLogout()
    logout()
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 w-60 shrink-0">
      {/* User info */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800">
        <Avatar className="w-7 h-7">
          <AvatarImage src={user?.avatar} alt={user?.name} />
          <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-400">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-300 truncate">{user?.name}</p>
          <p className="text-[10px] text-zinc-600 truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="w-6 h-6 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
          title="Sign out"
        >
          <ChevronRight size={13} />
        </Button>
      </div>

      {/* Sessions header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Saved Sessions
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="w-5 h-5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          onClick={() => setCreateOpen(true)}
          title="New session"
        >
          <Plus size={12} />
        </Button>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {sessions.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Terminal size={20} className="mx-auto mb-2 text-zinc-700" />
            <p className="text-[11px] text-zinc-600">No saved sessions</p>
            <p className="text-[10px] text-zinc-700 mt-1">
              Sessions let you restore terminal history
            </p>
          </div>
        ) : (
          <div className="px-2 pb-2 space-y-0.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-900 cursor-pointer transition-colors"
                onClick={() => { SessionTouch(s.id); onOpenSession(s) }}
              >
                {sessionColors[s.id] ? (
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white/10"
                    style={{ background: sessionColors[s.id] }}
                  />
                ) : (
                  <Terminal size={12} className="text-zinc-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate">{s.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 h-3.5 bg-zinc-800 text-zinc-500 border-0"
                    >
                      {s.shell}
                    </Badge>
                    <Clock size={9} className="text-zinc-700" />
                    <span className="text-[9px] text-zinc-700">
                      {formatDate(s.last_used_at)}
                    </span>
                  </div>
                </div>

                {/* Context menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                    >
                      ···
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="bg-zinc-900 border-zinc-700 text-zinc-300 min-w-[130px]"
                    align="end"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800 gap-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRenameId(s.id)
                        setRenameName(s.name)
                      }}
                    >
                      <Pencil size={12} /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-red-400 hover:bg-zinc-800 focus:bg-zinc-800 gap-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(s.id)
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </DropdownMenuItem>
                    <div className="px-2 py-1.5 flex items-center gap-1.5">
                      <Palette size={10} className="text-zinc-600 mr-0.5" />
                      <button
                        title="No color"
                        onClick={(e) => { e.stopPropagation(); handleSessionColor(s.id, '') }}
                        className={cn(
                          'w-4 h-4 rounded-full border-2 transition-all hover:scale-110',
                          !sessionColors[s.id] ? 'border-zinc-300' : 'border-zinc-600 hover:border-zinc-400'
                        )}
                      />
                      {TAB_COLORS.map((c) => (
                        <button
                          key={c}
                          title={c}
                          onClick={(e) => { e.stopPropagation(); handleSessionColor(s.id, c) }}
                          style={{
                            background: c,
                            outline: sessionColors[s.id] === c ? `2px solid ${c}` : undefined,
                            outlineOffset: '2px',
                          }}
                          className="w-4 h-4 rounded-full hover:scale-110 transition-all"
                        />
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator className="bg-zinc-800" />
      <div className="p-2">
        <p className="text-[9px] text-zinc-700 text-center">Tenet v0.1</p>
      </div>

      {/* Create session dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-200 sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              placeholder="Session name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-600"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-200 sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Rename Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 focus-visible:ring-zinc-600"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRenameId(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRename}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

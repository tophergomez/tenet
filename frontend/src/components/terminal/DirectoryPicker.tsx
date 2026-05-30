import { useState, useEffect, useCallback } from 'react'
import { Folder, ChevronRight, ChevronDown, Home } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DirList, DirHome } from '../../../wailsjs/go/main/App'

interface DirEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  mode: string
}

interface DirectoryPickerProps {
  open: boolean
  onSelect: (path: string) => void
  onClose: () => void
}

export function DirectoryPicker({ open, onSelect, onClose }: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const items = await DirList(path)
      setEntries((items ?? []).filter((e) => e.is_dir))
      setCurrentPath(path)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // Load the home directory when the dialog opens; reset state when it closes.
  // useEffect is required here because Radix UI's onOpenChange does NOT fire
  // when `open` is set programmatically — only on user-initiated close gestures.
  useEffect(() => {
    if (open) {
      setEntries([])
      setCurrentPath('')
      setError(null)
      DirHome().then((home) => navigate(home)).catch(() => {})
    }
  }, [open, navigate])

  const navigateUp = () => {
    if (!currentPath) return
    // Normalise to forward slashes, drop empty segments (handles trailing sep)
    const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts.length <= 1) return
    let parent = parts.slice(0, -1).join('/')
    // Windows bare drive letter "C:" → "C:/" so the backend treats it as root
    if (/^[A-Za-z]:$/.test(parent)) parent += '/'
    navigate(parent)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
    >
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-200 sm:max-w-[480px] max-h-[70vh]">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Folder size={16} />
            Select Directory
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800 rounded text-xs font-mono text-zinc-400 overflow-x-auto">
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 shrink-0 text-zinc-500 hover:text-zinc-200"
            onClick={() => DirHome().then((home) => navigate(home))}
          >
            <Home size={11} />
          </Button>
          <ChevronRight size={11} className="shrink-0" />
          <span className="truncate">{currentPath || '~'}</span>
        </div>

        {/* Directory list */}
        <ScrollArea className="h-64 mt-1">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">
              Loading…
            </div>
          ) : error ? (
            <p className="text-xs text-red-400 text-center py-4">{error}</p>
          ) : (
            <div className="space-y-0.5">
              {/* Parent dir */}
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer text-sm text-zinc-400 hover:text-zinc-200"
                onClick={navigateUp}
              >
                <ChevronDown size={13} className="text-zinc-600 rotate-90" />
                <span className="font-mono text-xs">..</span>
              </div>
              {entries.map((e) => (
                <div
                  key={e.path}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer"
                  onClick={() => navigate(e.path)}
                >
                  <Folder size={13} className="text-blue-400 shrink-0" />
                  <span className="text-sm text-zinc-300 truncate">{e.name}</span>
                </div>
              ))}
              {entries.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4">Empty directory</p>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 justify-end mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSelect(currentPath)
            }}
            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
            disabled={!currentPath}
          >
            Open here
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

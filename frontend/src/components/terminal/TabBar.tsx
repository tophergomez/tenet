import { useState } from 'react'
import { Plus, X, Clock, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTerminalStore, type ShellType, TAB_COLORS } from '../../store/terminal'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const SHELL_ICONS: Record<string, string> = {
  powershell: 'PS',
  cmd: 'CMD',
  bash: 'SH',
  zsh: 'ZSH',
  fish: 'FISH',
}

function formatSavedTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

interface TabBarProps {
  onNewTab: (shell: ShellType) => void
  onCloseTab: (termID: string) => void
}

export function TabBar({ onNewTab, onCloseTab }: TabBarProps) {
  const { tabs, activeTabId, setActive, availableShells, updateTabColor } = useTerminalStore()
  const [hovered, setHovered] = useState<string | null>(null)
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)

  const handleColorSelect = (tabId: string, color: string, sessionId?: string) => {
    updateTabColor(tabId, color)
    if (sessionId) {
      if (color) {
        localStorage.setItem(`tenet:session-color:${sessionId}`, color)
      } else {
        localStorage.removeItem(`tenet:session-color:${sessionId}`)
      }
    }
    setColorPickerFor(null)
  }

  return (
    <div className="flex items-center h-10 bg-zinc-950 border-b border-zinc-800 overflow-x-auto scrollbar-none select-none shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onMouseEnter={() => setHovered(tab.id)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => setActive(tab.id)}
          style={{
            borderBottom: `3px solid ${tab.color || 'transparent'}`,
            ...(tab.color && {
              backgroundColor:
                activeTabId === tab.id ? `${tab.color}28` : `${tab.color}12`,
            }),
          }}
          className={cn(
            'flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[200px] cursor-pointer border-r border-zinc-800 transition-all',
            activeTabId === tab.id
              ? cn('text-zinc-100', !tab.color && 'bg-zinc-900')
              : cn('text-zinc-500 hover:text-zinc-300', !tab.color && 'bg-zinc-950 hover:bg-zinc-900/60')
          )}
        >
          <span
            style={
              tab.color
                ? {
                    color: tab.color,
                    backgroundColor: `${tab.color}25`,
                    border: `1px solid ${tab.color}55`,
                  }
                : undefined
            }
            className={cn(
              'text-[10px] font-bold font-mono px-1 py-0.5 rounded leading-none shrink-0',
              !tab.color && 'text-zinc-500'
            )}
          >
            {SHELL_ICONS[tab.shell] ?? tab.shell.toUpperCase()}
          </span>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs truncate">
              {tab.title}
              {!tab.isAlive && <span className="ml-1 text-zinc-600">[done]</span>}
            </span>
            {tab.lastSavedAt && (
              <span className="flex items-center gap-0.5 text-[9px] text-zinc-600 leading-none">
                <Clock size={8} className="shrink-0" />
                {formatSavedTime(tab.lastSavedAt)}
              </span>
            )}
          </div>
          {(hovered === tab.id || activeTabId === tab.id) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Color picker */}
              <DropdownMenu
                open={colorPickerFor === tab.id}
                onOpenChange={(open) => setColorPickerFor(open ? tab.id : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    style={tab.color ? { color: tab.color } : undefined}
                    className="w-4 h-4 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
                  >
                    <Palette size={10} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="bg-zinc-900 border-zinc-700 p-2.5 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      title="No color"
                      onClick={() => handleColorSelect(tab.id, '', tab.sessionId)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-all hover:scale-110',
                        !tab.color ? 'border-zinc-300' : 'border-zinc-600 hover:border-zinc-400'
                      )}
                    />
                    {TAB_COLORS.map((c) => (
                      <button
                        key={c}
                        title={c}
                        onClick={() => handleColorSelect(tab.id, c, tab.sessionId)}
                        style={{
                          background: c,
                          outline: tab.color === c ? `2px solid ${c}` : undefined,
                          outlineOffset: '2px',
                        }}
                        className="w-5 h-5 rounded-full transition-all hover:scale-110"
                      />
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Close */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab.id)
                }}
                className="w-4 h-4 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* New tab button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center w-9 h-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors shrink-0">
                <Plus size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-zinc-900 border-zinc-700 text-zinc-300 min-w-[140px]"
            >
              {availableShells.map((shell) => (
                <DropdownMenuItem
                  key={shell}
                  onClick={() => onNewTab(shell)}
                  className="cursor-pointer hover:bg-zinc-800 focus:bg-zinc-800"
                >
                  <span className="font-mono text-[10px] text-zinc-500 w-8">
                    {SHELL_ICONS[shell] ?? shell.toUpperCase()}
                  </span>
                  <span className="capitalize">{shell}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent side="bottom">New terminal</TooltipContent>
      </Tooltip>
    </div>
  )
}

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTerminalStore, type ShellType } from '../../store/terminal'
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

interface TabBarProps {
  onNewTab: (shell: ShellType) => void
  onCloseTab: (termID: string) => void
}

export function TabBar({ onNewTab, onCloseTab }: TabBarProps) {
  const { tabs, activeTabId, setActive, availableShells } = useTerminalStore()
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="flex items-center h-10 bg-zinc-950 border-b border-zinc-800 overflow-x-auto scrollbar-none select-none shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onMouseEnter={() => setHovered(tab.id)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => setActive(tab.id)}
          className={cn(
            'flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[200px] cursor-pointer border-r border-zinc-800 transition-colors',
            activeTabId === tab.id
              ? 'bg-zinc-900 text-zinc-100'
              : 'bg-zinc-950 text-zinc-500 hover:bg-zinc-900/60 hover:text-zinc-300'
          )}
        >
          <span className="text-[10px] font-bold font-mono text-zinc-500">
            {SHELL_ICONS[tab.shell] ?? tab.shell.toUpperCase()}
          </span>
          <span className="text-xs truncate flex-1">
            {tab.title}
            {!tab.isAlive && <span className="ml-1 text-zinc-600">[done]</span>}
          </span>
          {(hovered === tab.id || activeTabId === tab.id) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCloseTab(tab.id)
              }}
              className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700"
            >
              <X size={11} />
            </button>
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

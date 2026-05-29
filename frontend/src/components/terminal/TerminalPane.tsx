import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime'
import { TerminalWrite, TerminalResize, TerminalClose } from '../../../wailsjs/go/main/App'
import { useTerminalStore } from '../../store/terminal'
import '@xterm/xterm/css/xterm.css'

interface TerminalPaneProps {
  termID: string
  isActive: boolean
}

const THEME = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#a1a1aa',
  cursorAccent: '#09090b',
  selectionBackground: '#3f3f46',
  black: '#18181b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa',
}

export function TerminalPane({ termID, isActive }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const { markDead } = useTerminalStore()

  const handleResize = useCallback(() => {
    const fit = fitRef.current
    const term = termRef.current
    if (!fit || !term) return
    fit.fit()
    TerminalResize(termID, term.cols, term.rows).catch(() => {})
  }, [termID])

  useEffect(() => {
    if (!containerRef.current) return

    // ── Create terminal ───────────────────────────────────────────
    const term = new Terminal({
      fontFamily: '"Geist Mono Variable", "Cascadia Code", "JetBrains Mono", monospace',
      fontSize: 13.5,
      lineHeight: 1.4,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      theme: THEME,
      allowProposedApi: true,
      convertEol: true,
    })

    const fit = new FitAddon()
    const webLinks = new WebLinksAddon()
    const search = new SearchAddon()

    term.loadAddon(fit)
    term.loadAddon(webLinks)
    term.loadAddon(search)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    // ── Output from backend ──────────────────────────────────────
    const outputEvent = `terminal:output:${termID}`
    const exitEvent = `terminal:exit:${termID}`

    const handleOutput = (data: string) => {
      term.write(data)
    }

    const handleExit = (code: number) => {
      term.writeln(`\r\n\x1b[38;5;240m[Process exited with code ${code}]\x1b[0m`)
      markDead(termID)
    }

    EventsOn(outputEvent, handleOutput)
    EventsOn(exitEvent, handleExit)

    // ── User input → backend ─────────────────────────────────────
    term.onData((data) => {
      TerminalWrite(termID, data).catch(() => {})
    })

    // ── Resize observer ──────────────────────────────────────────
    const ro = new ResizeObserver(() => handleResize())
    ro.observe(containerRef.current)

    return () => {
      EventsOff(outputEvent)
      EventsOff(exitEvent)
      ro.disconnect()
      TerminalClose(termID)
      term.dispose()
    }
  }, [termID, markDead, handleResize])

  // Re-fit when tab becomes active
  useEffect(() => {
    if (isActive) {
      setTimeout(() => handleResize(), 50)
      termRef.current?.focus()
    }
  }, [isActive, handleResize])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ padding: '4px 8px' }}
    />
  )
}

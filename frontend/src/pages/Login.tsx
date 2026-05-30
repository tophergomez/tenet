import { useState } from 'react'
import { LogIn, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthStartLogin } from '../../wailsjs/go/main/App'

interface LoginProps {
  oauthConfigured: boolean
  dbConnected: boolean
  error: string | null
  loading: boolean
}

export function LoginPage({ oauthConfigured, dbConnected, error, loading }: LoginProps) {
  const [starting, setStarting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setStarting(true)
    setLocalError(null)
    try {
      await AuthStartLogin()
      // Success is handled via the auth:success Wails event in App.tsx
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : String(e))
      setStarting(false)
    }
  }

  const displayError = error ?? localError

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-zinc-950 select-none">
      {/* Logo */}
      <div className="mb-10 text-center">
        <span className="block font-mono text-5xl font-black tracking-[0.3em] text-zinc-200">
          TENET
        </span>
        <p className="mt-2 text-sm text-zinc-600 tracking-wide">
          A modern terminal for professionals
        </p>
      </div>

      {/* Status badges */}
      <div className="flex gap-3 mb-8">
        <StatusDot ok={dbConnected} label="Database" />
        <StatusDot ok={oauthConfigured} label="OAuth" />
      </div>

      {/* Error */}
      {displayError && (
        <div className="flex items-start gap-2 mb-6 px-4 py-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-400 text-sm max-w-sm">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* CTA */}
      <Button
        size="lg"
        disabled={starting || loading || !oauthConfigured || !dbConnected}
        onClick={handleGoogleLogin}
        className="gap-3 bg-white text-zinc-900 hover:bg-zinc-100 font-medium h-12 px-6 disabled:opacity-40"
      >
        {starting || loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        {starting ? 'Opening browser…' : 'Continue with Google'}
      </Button>

      {!oauthConfigured && (
        <p className="mt-4 text-xs text-zinc-600 max-w-xs text-center">
          Create a <span className="text-zinc-400">.env</span> file with{' '}
          <code className="text-zinc-400">GOOGLE_CLIENT_ID</code> and{' '}
          <code className="text-zinc-400">GOOGLE_CLIENT_SECRET</code> to enable login.
        </p>
      )}

      {!dbConnected && oauthConfigured && (
        <p className="mt-4 text-xs text-zinc-600 max-w-xs text-center">
          Set <code className="text-zinc-400">DATABASE_URL</code> in your{' '}
          <span className="text-zinc-400">.env</span> file to enable login and save sessions.
        </p>
      )}
    </div>
  )
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
      <span
        className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-zinc-600'}`}
      />
      {label}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

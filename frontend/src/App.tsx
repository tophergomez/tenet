import { useEffect, useState } from 'react'
import { EventsOn } from '../wailsjs/runtime/runtime'
import { AuthStatus } from '../wailsjs/go/main/App'
import { useAuthStore, type User } from './store/auth'
import { LoginPage } from './pages/Login'
import { TerminalPage } from './pages/Terminal'

export default function App() {
  const { user, setUser, setLoading, logout } = useAuthStore()
  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [dbConnected, setDbConnected] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [booting, setBooting] = useState(true)

  // Bootstrap — check persisted session
  useEffect(() => {
    AuthStatus().then((status) => {
      setOauthConfigured(status.oauth_configured)
      setDbConnected(status.db_connected)
      if (status.current_user) {
        setUser(status.current_user as User)
      } else {
        setLoading(false)
      }
      setBooting(false)
    })
  }, [setUser, setLoading])

  // Listen for OAuth events from the Go backend
  useEffect(() => {
    const unsubSuccess = EventsOn('auth:success', (payload: User) => {
      setUser(payload)
      setAuthError(null)
    })
    const unsubError = EventsOn('auth:error', (msg: string) => {
      setAuthError(msg)
    })
    const unsubLogout = EventsOn('auth:logout', () => {
      logout()
    })
    return () => {
      unsubSuccess()
      unsubError()
      unsubLogout()
    }
  }, [setUser, logout])

  if (booting) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-zinc-950">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <LoginPage
        oauthConfigured={oauthConfigured}
        dbConnected={dbConnected}
        error={authError}
        loading={false}
      />
    )
  }

  return <TerminalPage />
}


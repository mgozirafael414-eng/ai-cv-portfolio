import { useEffect, useState } from 'react'
import { authApi, clearAuth } from '../services/api.js'
import { AuthContext } from './auth-context.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem('cv_auth_token')) return null
    try { return JSON.parse(localStorage.getItem('cv_auth_user')) || null } catch { return null }
  })
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('cv_auth_token')))

  useEffect(() => {
    const restore = async () => {
      if (!localStorage.getItem('cv_auth_token')) {
        localStorage.removeItem('cv_auth_user')
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const currentUser = await authApi.currentUser()
        setUser(currentUser)
        localStorage.setItem('cv_auth_user', JSON.stringify(currentUser))
      } catch {
        clearAuth()
        setUser(null)
      } finally { setLoading(false) }
    }
    restore()
    const handleUnauthorized = () => { clearAuth(); setUser(null) }
    window.addEventListener('cv:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('cv:unauthorized', handleUnauthorized)
  }, [])

  const login = async (payload) => {
    const result = await authApi.login(payload)
    localStorage.setItem('cv_auth_token', result.token)
    localStorage.setItem('cv_auth_user', JSON.stringify(result.user))
    setUser(result.user)
    return result.user
  }
  const register = async (payload) => authApi.register(payload)
  const logout = () => { clearAuth(); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}


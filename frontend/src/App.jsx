import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './hooks/useAuth.js'
import { DashboardPage } from './pages/dashboard/DashboardPage.jsx'
import { PortfolioPublicPage } from './pages/public/PortfolioPublicPage.jsx'
import { LoginPage, RegisterPage } from './pages/auth/AuthPages.jsx'
import './App.css'

const routeNames = {
  '/': 'dashboard', '/dashboard': 'dashboard', '/profile': 'profile',
  '/education': 'education', '/experience': 'experience', '/skills': 'skills',
  '/projects': 'projects', '/certificates': 'certificates', '/cv-builder': 'cv-builder',
  '/ai-assistant': 'ai-assistant', '/portfolio': 'portfolio',
}

function AppContent() {
  const { user, loading } = useAuth()
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    const onUnauthorized = () => navigate('/login')
    window.addEventListener('popstate', onPopState)
    window.addEventListener('cv:unauthorized', onUnauthorized)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('cv:unauthorized', onUnauthorized)
    }
  }, [])

  if (loading) return <div className="page-loading">Restoring your workspace...</div>
  if (path.startsWith('/portfolio/')) return <PortfolioPublicPage slug={path.replace('/portfolio/', '')} />
  if (!user) return path === '/register' ? <RegisterPage navigate={navigate} /> : <LoginPage navigate={navigate} />
  if (!routeNames[path]) return <DashboardPage page="dashboard" navigate={navigate} />
  return <DashboardPage page={routeNames[path]} navigate={navigate} />

  function navigate(nextPath) {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }
}

function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}

export default App

import { useState } from 'react'
import { ApiError } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'

export function LoginPage({ navigate }) {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState({ loading: false, error: '' })
  const submit = async (event) => {
    event.preventDefault(); setState({ loading: true, error: '' })
    try { await login(form); navigate('/dashboard') } catch (error) { setState({ loading: false, error: error instanceof ApiError ? error.message : 'Unable to sign in.' }) }
  }
  return <AuthLayout title="Welcome back" subtitle="Your professional story, in one focused workspace.">
    <form className="auth-form" onSubmit={submit}>
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} required minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button></span></label>
      {state.error && <p className="form-error">{state.error}</p>}
      <button className="primary-button" disabled={state.loading}>{state.loading ? 'Signing in...' : 'Sign in'}</button>
      <p className="auth-switch">New here? <button type="button" className="text-button" onClick={() => navigate('/register')}>Create an account</button></p>
    </form>
  </AuthLayout>
}

export function RegisterPage({ navigate }) {
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState({ loading: false, error: '', success: '' })
  const submit = async (event) => {
    event.preventDefault(); setState({ loading: true, error: '', success: '' })
    try { await register(form); setState({ loading: false, error: '', success: 'Account created. You can sign in now.' }) } catch (error) { setState({ loading: false, error: error instanceof ApiError ? error.message : 'Unable to create your account.', success: '' }) }
  }
  return <AuthLayout title="Make your next move" subtitle="Set up the foundation for a CV that moves with you.">
    <form className="auth-form" onSubmit={submit}>
      <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} required minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOffIcon /> : <EyeIcon />}</button></span></label>
      {state.error && <p className="form-error">{state.error}</p>}
      {state.success && <p className="form-success">{state.success}</p>}
      <button className="primary-button" disabled={state.loading}>{state.loading ? 'Creating...' : 'Create account'}</button>
      <p className="auth-switch">Already have an account? <button type="button" className="text-button" onClick={() => navigate('/login')}>Sign in</button></p>
    </form>
  </AuthLayout>
}

function AuthLayout({ title, subtitle, children }) {
  return <main className="auth-page"><section className="auth-intro"><div className="auth-intro-copy"><p className="eyebrow">Professional identity, organized</p><h1>{title}</h1><p>{subtitle}</p></div><div className="auth-intro-note"><span>CV</span><span className="auth-intro-separator" aria-hidden="true">·</span><span>Portfolio</span><span className="auth-intro-separator" aria-hidden="true">·</span><span>AI-assisted growth</span></div></section><section className="auth-panel"><div className="auth-panel-inner"><p className="eyebrow">Workspace access</p><h2>Build from what you know.</h2>{children}</div></section></main>
}

function EyeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></svg>
}

function EyeOffIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6.1 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.6M6.2 6.8C3.8 8.2 2.5 12 2.5 12s3.4 6 9.5 6c1.2 0 2.3-.2 3.2-.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
}

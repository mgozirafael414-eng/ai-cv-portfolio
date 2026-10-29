import { useEffect, useState } from 'react'
import { ApiError, profileApi, resolveApiAssetUrl } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'

const emptyProfile = { phone: '', location: '', headline: '', bio: '', profileImage: '', linkedinUrl: '', githubUrl: '', websiteUrl: '' }
const editableProfileFields = Object.keys(emptyProfile)

export function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm] = useState(emptyProfile)
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' })
  useEffect(() => {
    profileApi.get().then((profile) => setForm({ ...emptyProfile, ...profile })).catch((error) => {
      if (!(error instanceof ApiError && error.status === 404)) setState({ loading: false, saving: false, error: 'Unable to load your profile.', success: '' })
    }).finally(() => setState((current) => ({ ...current, loading: false })))
  }, [])
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const uploadImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const profile = await profileApi.uploadImage(file)
      setForm((current) => ({ ...current, ...profile }))
      setState((current) => ({ ...current, error: '', success: 'Profile picture saved.' }))
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof ApiError ? error.message : 'Unable to upload profile picture.', success: '' }))
    }
  }
  const removeImage = async () => {
    try {
      const profile = await profileApi.removeImage()
      setForm((current) => ({ ...current, ...profile }))
      setState((current) => ({ ...current, error: '', success: 'Profile picture removed.' }))
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof ApiError ? error.message : 'Unable to remove profile picture.', success: '' }))
    }
  }
  const submit = async (event) => {
    event.preventDefault(); setState({ loading: false, saving: true, error: '', success: '' })
    const payload = Object.fromEntries(editableProfileFields.map((field) => [field, form[field] || null]))
    try { const profile = await profileApi.update(payload); setForm({ ...emptyProfile, ...profile }); setState({ loading: false, saving: false, error: '', success: 'Profile saved.' }) }
    catch (error) { setState({ loading: false, saving: false, error: error instanceof ApiError ? [error.message, ...error.details].join(' ') : 'Unable to save your profile.', success: '' }) }
  }
  if (state.loading) return <p className="state-message">Loading profile...</p>
  return <div className="profile-page"><div className="resource-toolbar"><div><p className="eyebrow">Your foundation</p><h2>Profile</h2></div><span className="stamp">PRIVATE</span></div><p className="section-lede">Keep the essentials current. This information will anchor your CV and portfolio later.</p>{state.error && <p className="form-error banner">{state.error}</p>}{state.success && <p className="form-success banner">{state.success}</p>}<section className="profile-image-section"><div className="profile-image-preview">{form.profileImage ? <img src={resolveApiAssetUrl(form.profileImage)} alt="Profile" /> : <span>{getInitials(user?.name || '')}</span>}</div><div><p className="eyebrow">Profile picture</p><p className="profile-image-help">Use a JPG, PNG, or WEBP image up to 5 MB.</p><div className="profile-image-actions"><label className="secondary-button profile-upload-button">{form.profileImage ? 'Change photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} /></label>{form.profileImage && <button type="button" className="text-button" onClick={removeImage}>Remove photo</button>}</div></div></section><form className="profile-form" onSubmit={submit}><div className="profile-fields"><Field label="Headline" value={form.headline} onChange={(v) => update('headline', v)} placeholder="Product designer who makes complex things clear" /><Field label="Phone" value={form.phone} onChange={(v) => update('phone', v)} /><Field label="Location" value={form.location} onChange={(v) => update('location', v)} placeholder="City, country" /></div><label>Bio<textarea rows="7" value={form.bio} onChange={(e) => update('bio', e.target.value)} placeholder="A concise introduction to your work and point of view." /></label><div className="profile-fields"><Field label="LinkedIn URL" value={form.linkedinUrl} onChange={(v) => update('linkedinUrl', v)} placeholder="https://linkedin.com/in/..." /><Field label="GitHub URL" value={form.githubUrl} onChange={(v) => update('githubUrl', v)} placeholder="https://github.com/..." /><Field label="Website URL" value={form.websiteUrl} onChange={(v) => update('websiteUrl', v)} placeholder="https://..." /></div><button className="primary-button" disabled={state.saving}>{state.saving ? 'Saving...' : 'Save profile'}</button></form></div>
}
function Field({ label, value, onChange, placeholder }) { return <label>{label}<input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label> }
function getInitials(name) { const parts = String(name || '').trim().split(/\s+/).filter(Boolean); return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : (parts[0]?.[0] || '?').toUpperCase() }

import { useEffect, useState } from 'react'
import { ApiError, certificatesApi, cvPdfApi, educationApi, experienceApi, profileApi, projectsApi, skillsApi } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ClassicTemplate, MinimalTemplate, ModernTemplate } from './templates/CVTemplates.jsx'
import './cv.css'

const defaultSettings = {
  title: 'Professional CV',
  template: 'classic',
  sections: { summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, contact: true },
}

const sectionLabels = { summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', certificates: 'Certificates', contact: 'Contact information' }

export function CVBuilder({ navigate }) {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(() => loadSettings(user.id))
  const [activeView, setActiveView] = useState('controls')
  const [error, setError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      profileApi.get().catch((requestError) => requestError.status === 404 ? null : Promise.reject(requestError)),
      experienceApi.list(), educationApi.list(), skillsApi.list(), projectsApi.list(), certificatesApi.list(),
    ]).then(([profile, experience, education, skills, projects, certificates]) => {
      if (active) setData({ user, profile, experience, education, skills, projects, certificates })
    }).catch((requestError) => { if (active) setError(requestError instanceof ApiError ? requestError.message : 'Unable to load CV data.') })
    return () => { active = false }
  }, [user])

  const updateSettings = (next) => { setSettings(next); localStorage.setItem(settingsKey(user.id), JSON.stringify(next)) }
  const toggleSection = (section) => updateSettings({ ...settings, sections: { ...settings.sections, [section]: !settings.sections[section] } })

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true)
    setDownloadError('')
    try {
      await cvPdfApi.download()
    } catch (requestError) {
      setDownloadError(requestError instanceof ApiError ? requestError.message : 'Unable to download your CV PDF.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  if (error) return <div className="cv-state"><span className="stamp">ERROR</span><h2>CV data could not load.</h2><p>{error}</p></div>
  if (!data) return <div className="state-message">Loading your CV data...</div>
  if (downloadError) return <div className="cv-state"><span className="stamp">ERROR</span><h2>CV PDF could not download.</h2><p>{downloadError}</p><button className="secondary-button" onClick={() => setDownloadError('')}>Return to CV Builder</button></div>

  return <div className="cv-builder"><div className="cv-builder-header"><div><p className="eyebrow">Compose your next step</p><h2>CV Builder</h2></div><div className="cv-view-switch"><button className={activeView === 'controls' ? 'active' : ''} onClick={() => setActiveView('controls')}>Controls</button><button className={activeView === 'preview' ? 'active' : ''} onClick={() => setActiveView('preview')}>Preview</button></div></div><div className="cv-builder-grid"><aside className={`cv-controls ${activeView === 'preview' ? 'mobile-hidden' : ''}`}><label className="cv-title-field">CV title<input value={settings.title} maxLength="120" onChange={(event) => updateSettings({ ...settings, title: event.target.value })} /></label><div className="control-group"><p className="control-label">Template</p><div className="template-options">{[['classic', 'Classic'], ['modern', 'Modern'], ['minimal', 'Minimal']].map(([value, label]) => <button key={value} className={settings.template === value ? 'template-option selected' : 'template-option'} onClick={() => updateSettings({ ...settings, template: value })}><span className={`template-swatch ${value}`}></span><span>{label}</span><small>{value === 'classic' ? 'Traditional and clear' : value === 'modern' ? 'Structured and bold' : 'Quiet and focused'}</small></button>)}</div></div><div className="control-group"><p className="control-label">Visible sections</p><div className="section-toggles">{Object.entries(sectionLabels).map(([key, label]) => <label className="toggle-row" key={key}><input type="checkbox" checked={settings.sections[key]} onChange={() => toggleSection(key)} /><span>{label}</span></label>)}</div></div><div className="edit-links"><p className="control-label">Manage source data</p>{[['profile', 'Edit profile'], ['experience', 'Manage experience'], ['education', 'Manage education'], ['skills', 'Manage skills'], ['projects', 'Manage projects'], ['certificates', 'Manage certificates']].map(([path, label]) => <button key={path} onClick={() => navigate(`/${path}`)}>{label} ↗</button>)}</div><button className="primary-button" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>{isDownloadingPdf ? 'Generating PDF...' : 'Download CV PDF'}</button></aside><div className={`cv-preview-wrap ${activeView === 'controls' ? 'mobile-hidden' : ''}`}><div className="cv-preview-toolbar"><span>A4 preview</span><span>{settings.template} template</span></div><CVPreview data={data} settings={settings} /></div></div></div>
}

function CVPreview({ data, settings }) {
  const props = { data, sections: settings.sections, title: settings.title }
  if (settings.template === 'modern') return <ModernTemplate {...props} />
  if (settings.template === 'minimal') return <MinimalTemplate {...props} />
  return <ClassicTemplate {...props} />
}

function settingsKey(userId) { return `cv_builder_settings_${userId}` }
function loadSettings(userId) { try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}'), sections: { ...defaultSettings.sections, ...(JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}').sections || {}) } } } catch { return defaultSettings } }

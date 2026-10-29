import { useEffect, useState } from 'react'
import { ApiError, certificatesApi, cvPdfApi, educationApi, experienceApi, profileApi, projectsApi, skillsApi } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ClassicTemplate, CreativeTemplate, MinimalTemplate, ModernTemplate, ProfessionalTemplate } from './templates/CVTemplates.jsx'
import { CV_COLOR_PRESETS, CV_TEMPLATES, getColorPreset } from './cvSettings.js'
import './cv.css'

const defaultSettings = {
  title: 'Professional CV',
  template: 'professional',
  colorPreset: 'navy',
  sections: { summary: true, experience: true, education: true, skills: true, projects: true, certificates: true, contact: true },
}

const sectionLabels = { summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', certificates: 'Certificates', contact: 'Contact information' }
const templateComponents = {
  professional: ProfessionalTemplate,
  modern: ModernTemplate,
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
  creative: CreativeTemplate,
}

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

  const updateSettings = (next) => {
    setSettings(next)
    localStorage.setItem(settingsKey(user.id), JSON.stringify(next))
  }
  const updateSetting = (key, value) => updateSettings({ ...settings, [key]: value })
  const toggleSection = (section) => updateSetting('sections', { ...settings.sections, [section]: !settings.sections[section] })

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true)
    setDownloadError('')
    try {
      await cvPdfApi.download(settings)
    } catch (requestError) {
      setDownloadError(requestError instanceof ApiError ? requestError.message : 'Unable to download your CV PDF.')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  if (error) return <div className="cv-state"><span className="stamp">ERROR</span><h2>CV data could not load.</h2><p>{error}</p></div>
  if (!data) return <div className="state-message">Loading your CV data...</div>
  if (downloadError) return <div className="cv-state"><span className="stamp">ERROR</span><h2>CV PDF could not download.</h2><p>{downloadError}</p><button className="secondary-button" onClick={() => setDownloadError('')}>Return to CV Builder</button></div>

  return <div className="cv-builder">
    <div className="cv-builder-header">
      <div><p className="eyebrow">Compose your next step</p><h2>CV Builder</h2><p className="cv-builder-intro">Shape a recruiter-ready CV from your saved profile and career details.</p></div>
      <div className="cv-view-switch" role="group" aria-label="CV Builder view">
        <button className={activeView === 'controls' ? 'active' : ''} aria-pressed={activeView === 'controls'} onClick={() => setActiveView('controls')}>Design</button>
        <button className={activeView === 'preview' ? 'active' : ''} aria-pressed={activeView === 'preview'} onClick={() => setActiveView('preview')}>Preview</button>
      </div>
    </div>

    <div className="cv-builder-grid">
      <aside className={`cv-controls ${activeView === 'preview' ? 'mobile-hidden' : ''}`}>
        <label className="cv-title-field">CV title<input value={settings.title} maxLength="120" onChange={(event) => updateSetting('title', event.target.value)} /></label>

        <section className="control-group" aria-labelledby="template-label">
          <h3 className="control-label" id="template-label">Choose a template</h3>
          <div className="template-options">{CV_TEMPLATES.map((template) => <button
            type="button"
            key={template.id}
            className={`template-option${settings.template === template.id ? ' selected' : ''}`}
            aria-pressed={settings.template === template.id}
            onClick={() => updateSetting('template', template.id)}
          >
            <TemplateThumbnail type={template.preview} accent={getColorPreset(settings.colorPreset).accent} />
            <span className="template-option-copy"><strong>{template.label}</strong><small>{template.description}</small></span>
          </button>)}</div>
        </section>

        <section className="control-group" aria-labelledby="color-label">
          <h3 className="control-label" id="color-label">Accent color</h3>
          <div className="color-options" role="group" aria-label="CV color presets">{CV_COLOR_PRESETS.map((preset) => <button
            type="button"
            key={preset.id}
            className={`color-option${settings.colorPreset === preset.id ? ' selected' : ''}`}
            aria-label={preset.label}
            aria-pressed={settings.colorPreset === preset.id}
            title={preset.label}
            style={{ '--preset-accent': preset.accent }}
            onClick={() => updateSetting('colorPreset', preset.id)}
          ><span aria-hidden="true"></span><small>{preset.label}</small></button>)}</div>
        </section>

        <section className="control-group" aria-labelledby="section-label">
          <h3 className="control-label" id="section-label">Visible sections</h3>
          <div className="section-toggles">{Object.entries(sectionLabels).map(([key, label]) => <label className="toggle-row" key={key}><input type="checkbox" checked={settings.sections[key]} onChange={() => toggleSection(key)} /><span>{label}</span></label>)}</div>
        </section>

        <div className="edit-links"><p className="control-label">Manage source data</p>{[['profile', 'Edit profile'], ['experience', 'Manage experience'], ['education', 'Manage education'], ['skills', 'Manage skills'], ['projects', 'Manage projects'], ['certificates', 'Manage certificates']].map(([path, label]) => <button type="button" key={path} onClick={() => navigate(`/${path}`)}>{label} ↗</button>)}</div>
        <button className="primary-button cv-download-button" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>{isDownloadingPdf ? 'Generating PDF...' : 'Download CV PDF'}</button>
      </aside>

      <div className={`cv-preview-wrap ${activeView === 'controls' ? 'mobile-hidden' : ''}`}>
        <div className="cv-preview-toolbar"><span>A4 preview</span><span>{CV_TEMPLATES.find((template) => template.id === settings.template)?.label} · {getColorPreset(settings.colorPreset).label}</span></div>
        <CVPreview data={data} settings={settings} />
      </div>
    </div>
  </div>
}

function TemplateThumbnail({ type, accent }) {
  return <span className={`template-thumbnail template-thumbnail--${type}`} style={{ '--cv-thumb-accent': accent }} aria-hidden="true">
    <i /><i /><i /><i /><i /><i />
  </span>
}

function CVPreview({ data, settings }) {
  const Template = templateComponents[settings.template] || ProfessionalTemplate
  const preset = getColorPreset(settings.colorPreset)
  return <Template data={data} sections={settings.sections} title={settings.title} accent={preset.accent} secondary={preset.secondary} />
}

function settingsKey(userId) { return `cv_builder_settings_${userId}` }

function loadSettings(userId) {
  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey(userId)) || '{}')
    return {
      ...defaultSettings,
      ...stored,
      sections: { ...defaultSettings.sections, ...(stored.sections || {}) },
    }
  } catch {
    return defaultSettings
  }
}

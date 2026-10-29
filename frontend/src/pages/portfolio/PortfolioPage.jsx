import { useEffect, useMemo, useState } from 'react'
import { portfolioApi, profileApi, educationApi, experienceApi, skillsApi, projectsApi, certificatesApi } from '../../services/api.js'

const defaultPortfolio = { title: '', slug: '', template: 'professional', isPublished: false }

export function PortfolioPage() {
  const [portfolio, setPortfolio] = useState(defaultPortfolio)
  const [authUser, setAuthUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sections, setSections] = useState({ education: [], experience: [], skills: [], projects: [], certificates: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [currentPortfolio, currentProfile, education, experience, skills, projects, certificates] = await Promise.all([
        portfolioApi.get().catch((requestError) => requestError.status === 404 ? null : Promise.reject(requestError)),
          profileApi.get().catch(() => null),
          educationApi.list().catch(() => []),
          experienceApi.list().catch(() => []),
          skillsApi.list().catch(() => []),
          projectsApi.list().catch(() => []),
          certificatesApi.list().catch(() => []),
        ])

        setPortfolio(currentPortfolio || defaultPortfolio)
        setProfile(currentProfile)
        setSections({ education, experience, skills, projects, certificates })
        try {
          const storedUser = JSON.parse(localStorage.getItem('cv_auth_user') || 'null')
          setAuthUser(storedUser)
        } catch {
          setAuthUser(null)
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load your portfolio.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const publicUrl = portfolio.isPublished && portfolio.slug ? `${window.location.origin}/portfolio/${portfolio.slug}` : ''

  const updateField = (field) => (event) => {
    const value = event.target.value
    setPortfolio((current) => ({ ...current, [field]: value }))
    setError('')
    setSuccess('')
  }

  const getPortfolioPayload = () => {
    const ownerName = authUser?.name || profile?.name || 'Portfolio'
    const title = (portfolio.title ?? '').trim() || `${ownerName}'s portfolio`
    const slug = normalizeSlug((portfolio.slug ?? '').trim() || ownerName || 'portfolio')

    if (!slug) {
      throw new Error('A valid portfolio slug is required.')
    }

    return {
      title,
      slug,
      template: portfolio.template || 'professional',
      isPublished: Boolean(portfolio.isPublished),
    }
  }

  const savePortfolio = async () => {
    setError(''); setSuccess(''); setSaving(true)
    try {
      const payload = getPortfolioPayload()
      const savedPortfolio = portfolio.id ? await portfolioApi.update(payload) : await portfolioApi.create(payload)
      setPortfolio((current) => ({
        ...current,
        ...savedPortfolio,
        title: savedPortfolio.title ?? current.title,
        slug: savedPortfolio.slug ?? current.slug,
        template: savedPortfolio.template ?? current.template,
        isPublished: savedPortfolio.isPublished ?? current.isPublished,
      }))
      setSuccess('Portfolio saved.')
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your portfolio.')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async (nextState) => {
    if (nextState === false && !window.confirm('Unpublish your portfolio? The public URL will no longer be available.')) {
      return
    }

    setError(''); setSuccess(''); setPublishing(true)
    try {
      const payload = getPortfolioPayload()
      let savedPortfolio
      if (portfolio.id) {
        savedPortfolio = await portfolioApi.update(payload)
      } else {
        savedPortfolio = await portfolioApi.create(payload)
      }
      setPortfolio(savedPortfolio)

      const updatedPortfolio = await portfolioApi.publish(nextState)
      setPortfolio(updatedPortfolio)

      try {
        const refreshedPortfolio = await portfolioApi.get()
        setPortfolio(refreshedPortfolio)
      } catch (refreshError) {
        setError(`Portfolio ${nextState ? 'published' : 'unpublished'}, but its status could not be refreshed: ${refreshError instanceof Error ? refreshError.message : 'Please reload the page.'}`)
        return
      }

      setSuccess(nextState ? 'Portfolio published.' : 'Portfolio unpublished.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update publication status.')
    } finally {
      setPublishing(false)
    }
  }

  const previewPortfolio = () => {
    if (!portfolio.template || !['professional', 'modern', 'minimal'].includes(portfolio.template)) {
      setError('Please choose a valid portfolio template before previewing.')
      return
    }

    setError('')
    setSuccess('')
    setPreviewLoading(true)
    setShowPreview(true)
    setSuccess('Preview updated for the selected template.')
    setPreviewLoading(false)
  }

  const previewData = useMemo(() => ({
    user: {
      name: authUser?.name || profile?.name || '',
      headline: profile?.headline || '',
      location: profile?.location || '',
      bio: profile?.bio || '',
      profileImage: profile?.profileImage || '',
      websiteUrl: profile?.websiteUrl || '',
      githubUrl: profile?.githubUrl || '',
      linkedinUrl: profile?.linkedinUrl || '',
    },
    portfolio,
    sections,
  }), [authUser?.name, profile, portfolio, sections])

  if (loading) return <p className="state-message">Loading portfolio settings...</p>

  return (
    <div className="portfolio-page">
      <div className="resource-toolbar">
        <div>
          <p className="eyebrow">Your public presence</p>
          <h2>Portfolio</h2>
        </div>
        <span className="stamp">{portfolio.isPublished ? 'Published' : 'Private'}</span>
      </div>

      {error && <p className="form-error banner">{error}</p>}
      {success && <p className="form-success banner">{success}</p>}

      <div className="resource-columns portfolio-columns">
        <section className="editor-panel portfolio-settings-card">
          <div className="editor-heading">
            <p className="eyebrow">Portfolio settings</p>
          </div>

          <label>
            Portfolio title
            <input value={portfolio.title || ''} onChange={updateField('title')} placeholder="Rafael Mgozi — Software Developer" />
          </label>

          <label>
            Portfolio slug
            <input value={portfolio.slug || ''} onChange={updateField('slug')} placeholder="rafael-mgozi" />
          </label>

          <label>
            Template
            <select value={portfolio.template || 'professional'} onChange={updateField('template')}>
              <option value="professional">Professional</option>
              <option value="modern">Modern</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>

          <div className="portfolio-status-box">
            <strong>{portfolio.isPublished ? 'Portfolio is public' : 'Portfolio is private'}</strong>
            {publicUrl && <a href={publicUrl} target="_blank" rel="noreferrer">Open public URL ↗</a>}
          </div>

          <div className="form-actions">
            <button type="button" className="secondary-button" disabled={previewLoading} onClick={previewPortfolio}>{previewLoading ? 'Generating preview...' : 'Preview'}</button>
            <button type="button" className="primary-button" disabled={saving || publishing} onClick={savePortfolio}>{saving ? 'Saving...' : 'Save'}</button>
          </div>

          <div className="form-actions publish-actions">
            {portfolio.isPublished ? (
              <button type="button" className="secondary-button" disabled={saving || publishing} onClick={() => togglePublish(false)}>{publishing ? 'Unpublishing...' : 'Unpublish'}</button>
            ) : (
              <button type="button" className="primary-button" disabled={saving || publishing} onClick={() => togglePublish(true)}>{publishing ? 'Publishing...' : 'Publish'}</button>
            )}
          </div>
        </section>

        <section className="record-list portfolio-preview-panel">
          {showPreview ? <PortfolioPreview data={previewData} /> : <p className="state-message">Preview will appear here when you choose a template and click Preview.</p>}
        </section>
      </div>
    </div>
  )
}

function PortfolioPreview({ data }) {
  const template = data.portfolio.template || 'professional'
  const TargetTemplate = templateMap[template] || templateMap.professional
  return <TargetTemplate data={data} />
}

function ProfessionalTemplate({ data }) {
  const { user, sections } = data
  return (
    <article className="portfolio-public">
      <header className="portfolio-hero professional">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h2>{data.portfolio.title || user.name || 'Your portfolio'}</h2>
          <p>{user.headline || 'Professional portfolio'}</p>
          <div className="portfolio-links">
            {user.location && <span>{user.location}</span>}
            {user.websiteUrl && <a href={user.websiteUrl} target="_blank" rel="noreferrer">Website</a>}
            {user.githubUrl && <a href={user.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
            {user.linkedinUrl && <a href={user.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
          </div>
        </div>
        <div className="portfolio-avatar">{getInitials(user.name)}</div>
      </header>
      {user.bio && <section className="portfolio-section"><h3>About</h3><p>{user.bio}</p></section>}
      {sections.skills.length > 0 && <section className="portfolio-section"><h3>Skills</h3><ul className="tag-list">{sections.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul></section>}
      {sections.experience.length > 0 && <section className="portfolio-section"><h3>Experience</h3>{sections.experience.map((job) => <div key={job.id} className="portfolio-item"><h4>{formatExperienceTitle(job)}</h4><small>{formatRange(job.startDate, job.endDate)}</small><p>{job.description}</p></div>)}</section>}
      {sections.education.length > 0 && <section className="portfolio-section"><h3>Education</h3>{sections.education.map((item) => <div key={item.id} className="portfolio-item"><h4>{item.institution}</h4><small>{[item.degree, item.field].filter(Boolean).join(' · ')}</small><p>{formatRange(item.startDate, item.endDate)}</p></div>)}</section>}
      {sections.projects.length > 0 && <section className="portfolio-section"><h3>Projects</h3>{sections.projects.map((project) => <div key={project.id} className="portfolio-item"><h4>{project.title}</h4><p>{project.description}</p>{project.technologies?.length > 0 && <p>{project.technologies.join(' · ')}</p>}</div>)}</section>}
      {sections.certificates.length > 0 && <section className="portfolio-section"><h3>Certificates</h3>{sections.certificates.map((certificate) => <div key={certificate.id} className="portfolio-item"><h4>{certificate.name}</h4><small>{certificate.issuer}</small><p>{formatDate(certificate.issueDate)}</p></div>)}</section>}
    </article>
  )
}

function ModernTemplate({ data }) {
  const { user, sections } = data
  return (
    <article className="portfolio-public modern-template">
      <header className="portfolio-hero modern">
        <div>
          <p className="eyebrow">Available for work</p>
          <h2>{user.name || 'Your name'}</h2>
          <p>{user.headline || 'Product-minded builder'}</p>
        </div>
        <div className="portfolio-avatar">{getInitials(user.name)}</div>
      </header>
      {user.bio && <section className="portfolio-section"><h3>About</h3><p>{user.bio}</p></section>}
      {sections.projects.length > 0 && <section className="portfolio-section"><h3>Featured work</h3><div className="portfolio-grid">{sections.projects.map((project) => <div key={project.id} className="portfolio-card"><h4>{project.title}</h4><p>{project.description}</p>{project.technologies?.length > 0 && <small>{project.technologies.join(' • ')}</small>}</div>)}</div></section>}
      {sections.skills.length > 0 && <section className="portfolio-section"><h3>Skills</h3><ul className="tag-list">{sections.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul></section>}
      {sections.experience.length > 0 && <section className="portfolio-section"><h3>Experience</h3>{sections.experience.map((job) => <div key={job.id} className="portfolio-item"><h4>{formatExperienceTitle(job)}</h4><small>{formatRange(job.startDate, job.endDate)}</small><p>{job.description}</p></div>)}</section>}
      {sections.certificates.length > 0 && <section className="portfolio-section"><h3>Certificates</h3>{sections.certificates.map((certificate) => <div key={certificate.id} className="portfolio-item"><h4>{certificate.name}</h4><small>{certificate.issuer}</small></div>)}</section>}
    </article>
  )
}

function MinimalTemplate({ data }) {
  const { user, sections } = data
  return (
    <article className="portfolio-public minimal-template">
      <header className="portfolio-hero minimal">
        <h2>{user.name || 'Your name'}</h2>
        <p>{user.headline || 'Professional portfolio'}</p>
      </header>
      {user.bio && <section className="portfolio-section"><h3>About</h3><p>{user.bio}</p></section>}
      {sections.experience.length > 0 && <section className="portfolio-section"><h3>Experience</h3>{sections.experience.map((job) => <div key={job.id} className="portfolio-item"><h4>{formatExperienceTitle(job)}</h4><small>{formatRange(job.startDate, job.endDate)}</small></div>)}</section>}
      {sections.projects.length > 0 && <section className="portfolio-section"><h3>Projects</h3>{sections.projects.map((project) => <div key={project.id} className="portfolio-item"><h4>{project.title}</h4><p>{project.description}</p></div>)}</section>}
      {sections.education.length > 0 && <section className="portfolio-section"><h3>Education</h3>{sections.education.map((item) => <div key={item.id} className="portfolio-item"><h4>{item.institution}</h4><small>{item.degree || item.field}</small></div>)}</section>}
      {sections.skills.length > 0 && <section className="portfolio-section"><h3>Skills</h3><ul className="tag-list">{sections.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul></section>}
    </article>
  )
}

const templateMap = { professional: ProfessionalTemplate, modern: ModernTemplate, minimal: MinimalTemplate }

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatExperienceTitle(job) {
  const title = [job?.position, job?.title].find((value) => typeof value === 'string' && value.trim())
  const detail = [job?.company, job?.type, job?.category].find((value) => typeof value === 'string' && value.trim())

  const safeTitle = title ? title.trim() : ''
  const safeDetail = detail ? detail.trim() : ''

  if (!safeTitle && !safeDetail) return 'Experience'
  if (!safeTitle) return safeDetail
  if (!safeDetail) return safeTitle
  if (safeTitle.toLowerCase() === safeDetail.toLowerCase()) return safeTitle

  return `${safeTitle} · ${safeDetail}`
}

function getInitials(name) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ')
  if (!cleanName) return 'NA'

  const parts = cleanName.split(' ').filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatDate(value) {
  if (!value) return 'Date not set'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

function formatRange(startDate, endDate) {
  const start = startDate ? formatDate(startDate) : 'Start date not set'
  const end = endDate ? formatDate(endDate) : 'Present'
  return `${start} — ${end}`
}

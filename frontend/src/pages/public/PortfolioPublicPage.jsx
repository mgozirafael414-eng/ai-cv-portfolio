import { useEffect, useState } from 'react'
import { portfolioApi } from '../../services/api.js'

export function PortfolioPublicPage({ slug }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(Boolean(slug))
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return

    let active = true
    const fetchPortfolio = async () => {
      try {
        const portfolio = await portfolioApi.getPublic(slug)
        if (active) {
          setData(portfolio)
          setError('')
        }
      } catch {
        if (active) {
          setError('Portfolio not found')
          setData(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchPortfolio()

    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    if (!data) return
    const userName = data.user?.name || 'Portfolio'
    const title = data.title || `${userName} | Portfolio`
    document.title = title
    const metaDescription = document.querySelector('meta[name="description"]') || document.createElement('meta')
    metaDescription.name = 'description'
    metaDescription.content = data.user?.profile?.bio || `${userName}'s portfolio and professional profile.`
    if (!metaDescription.parentNode) {
      document.head.appendChild(metaDescription)
    }
  }, [data])

  if (loading) return <div className="public-portfolio-shell"><p className="state-message">Loading portfolio...</p></div>
  if (error || !data) {
    return (
      <div className="public-portfolio-shell">
        <div className="public-not-found">
          <p className="eyebrow">Portfolio unavailable</p>
          <h1>That portfolio is not public or no longer exists.</h1>
          <p>The page you requested could not be found.</p>
        </div>
      </div>
    )
  }

  const user = data.user || {}
  const profile = user.profile || {}
  const sections = {
    skills: user.skills || [],
    experience: user.experience || [],
    projects: user.projects || [],
    education: user.education || [],
    certificates: user.certificates || [],
  }

  const templateMap = {
    professional: ProfessionalTemplate,
    modern: ModernTemplate,
    minimal: MinimalTemplate,
  }
  const Template = templateMap[data.template] || ProfessionalTemplate

  return <div className="public-portfolio-shell"><Template data={{ portfolio: data, user, profile, sections }} /></div>
}

function ProfessionalTemplate({ data }) {
  const { portfolio, user, profile, sections } = data
  const { skills, experience, projects, education, certificates } = sections
  return (
    <article className="portfolio-public professional-template">
      <header className="portfolio-hero professional">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>{portfolio.title || user.name || 'Portfolio'}</h1>
          <p>{profile.headline || 'Professional portfolio'}</p>
          <div className="portfolio-links">
            {profile.location && <span>{profile.location}</span>}
            {profile.websiteUrl && <a href={profile.websiteUrl} target="_blank" rel="noreferrer">Website</a>}
            {profile.githubUrl && <a href={profile.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
            {profile.linkedinUrl && <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>}
          </div>
        </div>
        <div className="portfolio-avatar">{getInitials(user.name)}</div>
      </header>

      {profile.bio && <section className="portfolio-section"><h2>About</h2><p>{profile.bio}</p></section>}
      {skills.length > 0 && <section className="portfolio-section"><h2>Skills</h2><ul className="tag-list">{skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul></section>}
      {experience.length > 0 && <section className="portfolio-section"><h2>Experience</h2>{experience.map((job) => <div key={job.id} className="portfolio-item"><h3>{formatExperienceTitle(job)}</h3><small>{formatRange(job.startDate, job.endDate)}</small><p>{job.description}</p></div>)}</section>}
      {education.length > 0 && <section className="portfolio-section"><h2>Education</h2>{education.map((item) => <div key={item.id} className="portfolio-item"><h3>{item.institution}</h3><small>{[item.degree, item.field].filter(Boolean).join(' · ')}</small><p>{formatRange(item.startDate, item.endDate)}</p></div>)}</section>}
      {projects.length > 0 && <section className="portfolio-section"><h2>Projects</h2>{projects.map((project) => <div key={project.id} className="portfolio-item"><h3>{project.title}</h3><p>{project.description}</p>{project.technologies?.length > 0 && <small>{project.technologies.join(' • ')}</small>}</div>)}</section>}
      {certificates.length > 0 && <section className="portfolio-section"><h2>Certificates</h2>{certificates.map((certificate) => <div key={certificate.id} className="portfolio-item"><h3>{certificate.name}</h3><small>{certificate.issuer}</small><p>{formatDate(certificate.issueDate)}</p></div>)}</section>}
    </article>
  )
}

function ModernTemplate({ data }) {
  const { user, profile, sections } = data
  return (
    <article className="portfolio-public modern-template">
      <header className="portfolio-hero modern">
        <div>
          <p className="eyebrow">Available for work</p>
          <h1>{user.name || 'Your name'}</h1>
          <p>{profile.headline || 'Product-minded builder'}</p>
        </div>
        <div className="portfolio-avatar">{getInitials(user.name)}</div>
      </header>
      {profile.bio && <section className="portfolio-section"><h2>About</h2><p>{profile.bio}</p></section>}
      {sections.projects.length > 0 && <section className="portfolio-section"><h2>Featured work</h2><div className="portfolio-grid">{sections.projects.map((project) => <div key={project.id} className="portfolio-card"><h3>{project.title}</h3><p>{project.description}</p>{project.technologies?.length > 0 && <small>{project.technologies.join(' • ')}</small>}</div>)}</div></section>}
      {sections.skills.length > 0 && <section className="portfolio-section"><h2>Skills</h2><ul className="tag-list">{sections.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul></section>}
      {sections.experience.length > 0 && <section className="portfolio-section"><h2>Experience</h2>{sections.experience.map((job) => <div key={job.id} className="portfolio-item"><h3>{formatExperienceTitle(job)}</h3><small>{formatRange(job.startDate, job.endDate)}</small><p>{job.description}</p></div>)}</section>}
      {sections.certificates.length > 0 && <section className="portfolio-section"><h2>Certificates</h2>{sections.certificates.map((certificate) => <div key={certificate.id} className="portfolio-item"><h3>{certificate.name}</h3><small>{certificate.issuer}</small></div>)}</section>}
    </article>
  )
}

function MinimalTemplate({ data }) {
  const { user, profile, sections } = data
  return (
    <article className="portfolio-public minimal-template">
      <header className="portfolio-hero minimal">
        <h1>{user.name || 'Your name'}</h1>
        <p>{profile.headline || 'Professional portfolio'}</p>
      </header>
      {profile.bio && <section className="portfolio-section"><h2>About</h2><p>{profile.bio}</p></section>}
      {sections.experience.length > 0 && <section className="portfolio-section"><h2>Experience</h2>{sections.experience.map((job) => <div key={job.id} className="portfolio-item"><h3>{formatExperienceTitle(job)}</h3><small>{formatRange(job.startDate, job.endDate)}</small></div>)}</section>}
      {sections.projects.length > 0 && <section className="portfolio-section"><h2>Projects</h2>{sections.projects.map((project) => <div key={project.id} className="portfolio-item"><h3>{project.title}</h3><p>{project.description}</p></div>)}</section>}
      {sections.education.length > 0 && <section className="portfolio-section"><h2>Education</h2>{sections.education.map((item) => <div key={item.id} className="portfolio-item"><h3>{item.institution}</h3><small>{item.degree || item.field}</small></div>)}</section>}
      {sections.skills.length > 0 && <section className="portfolio-section"><h2>Skills</h2><ul className="tag-list">{sections.skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul></section>}
    </article>
  )
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

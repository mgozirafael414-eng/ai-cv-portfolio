import { useEffect, useState } from 'react'
import { portfolioApi, resolveApiAssetUrl } from '../../services/api.js'

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

  return <div className="public-portfolio-shell"><PortfolioContent data={{ portfolio: data, user, profile, sections }} /></div>
}

function PortfolioContent({ data }) {
  const { portfolio, user, profile, sections } = data
  const { skills, experience, projects, education, certificates } = sections
  const ownerName = user.name || portfolio.title || 'Portfolio'
  const profileImage = profile.profileImage ? resolveApiAssetUrl(profile.profileImage) : ''
  const contactLinks = [
    { label: 'Website', url: profile.websiteUrl },
    { label: 'GitHub', url: profile.githubUrl },
    { label: 'LinkedIn', url: profile.linkedinUrl },
  ].filter((link) => isHttpUrl(link.url))
  const template = ['professional', 'modern', 'minimal'].includes(portfolio.template)
    ? portfolio.template
    : 'professional'

  return (
    <main className={`public-portfolio public-portfolio--${template}`}>
      <nav className="public-portfolio-nav" aria-label="Portfolio sections">
        <a className="public-portfolio-brand" href="#top">{ownerName}</a>
        <div className="public-portfolio-nav-links">
          {projects.length > 0 && <a href="#projects">Projects</a>}
          {skills.length > 0 && <a href="#skills">Skills</a>}
          {experience.length > 0 && <a href="#experience">Experience</a>}
          {education.length > 0 && <a href="#education">Education</a>}
          {certificates.length > 0 && <a href="#certificates">Certificates</a>}
          {contactLinks.length > 0 && <a href="#contact">Contact</a>}
        </div>
      </nav>

      <header className="public-portfolio-hero" id="top">
        <div className="public-portfolio-hero-copy">
          <p className="public-portfolio-kicker">{portfolio.title && portfolio.title !== ownerName ? portfolio.title : 'Portfolio'}</p>
          <h1>{ownerName}</h1>
          {profile.headline && <p className="public-portfolio-headline">{profile.headline}</p>}
          {profile.location && <p className="public-portfolio-location">{profile.location}</p>}
          {profile.bio?.trim().length > 180 && <p className="public-portfolio-intro">{getExcerpt(profile.bio, 180)}</p>}
          <div className="public-portfolio-actions">
            {projects.length > 0 && <a className="public-portfolio-button public-portfolio-button--primary" href="#projects">View projects <span aria-hidden="true">↓</span></a>}
            {contactLinks.length > 0 && <a className="public-portfolio-button public-portfolio-button--secondary" href="#contact">Contact me</a>}
          </div>
        </div>
        <ProfilePortrait key={profileImage} imageUrl={profileImage} name={ownerName} />
      </header>

      {profile.bio && <section className="public-portfolio-section public-portfolio-about" id="about" aria-labelledby="about-heading">
        <div className="public-portfolio-section-heading"><p className="public-portfolio-kicker">A little about me</p><h2 id="about-heading">About</h2></div>
        <p>{profile.bio}</p>
      </section>}

      {projects.length > 0 && <section className="public-portfolio-section" id="projects" aria-labelledby="projects-heading">
        <div className="public-portfolio-section-heading"><p className="public-portfolio-kicker">Selected work</p><h2 id="projects-heading">Projects</h2></div>
        <div className="public-portfolio-project-grid">{projects.map((project) => {
          const projectLinks = [
            { label: 'GitHub repository', url: project.githubUrl },
            { label: 'Live project', url: project.liveUrl },
          ].filter((link) => isHttpUrl(link.url))
          const description = project.description ? getExcerpt(project.description, 190) : ''
          return <article className="public-portfolio-project" key={project.id}>
            <div className="public-portfolio-project-media">
              <div className="public-portfolio-project-placeholder" aria-hidden="true"><span>{getInitials(project.title)}</span></div>
              {isHttpUrl(project.imageUrl) && <img className="public-portfolio-project-image" src={project.imageUrl} alt={`${project.title} project`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} />}
            </div>
            <div className="public-portfolio-project-content">
              <h3>{project.title}</h3>
              {description && <p>{description}</p>}
              {project.technologies?.length > 0 && <ul className="public-portfolio-tags" aria-label={`${project.title} technologies`}>{project.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul>}
              {projectLinks.length > 0 && <div className="public-portfolio-project-links">{projectLinks.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></a>)}</div>}
            </div>
          </article>
        })}</div>
      </section>}

      {skills.length > 0 && <section className="public-portfolio-section" id="skills" aria-labelledby="skills-heading">
        <div className="public-portfolio-section-heading"><p className="public-portfolio-kicker">What I work with</p><h2 id="skills-heading">Skills</h2></div>
        <ul className="public-portfolio-tags">{skills.map((skill) => <li key={skill.id}>{skill.name}</li>)}</ul>
      </section>}

      {(experience.length > 0 || education.length > 0) && <section className="public-portfolio-section public-portfolio-journey" aria-label="Experience and education">
        {experience.length > 0 && <div className="public-portfolio-timeline" id="experience">
          <div className="public-portfolio-section-heading"><p className="public-portfolio-kicker">Career</p><h2>Experience</h2></div>
          {experience.map((job) => <article className="public-portfolio-timeline-item" key={job.id}>
            <div><h3>{formatExperienceTitle(job)}</h3>{job.description && <p>{job.description}</p>}</div>
            {(job.startDate || job.endDate) && <p className="public-portfolio-date">{formatRange(job.startDate, job.endDate)}</p>}
          </article>)}
        </div>}
        {education.length > 0 && <div className="public-portfolio-timeline" id="education">
          <div className="public-portfolio-section-heading"><p className="public-portfolio-kicker">Learning</p><h2>Education</h2></div>
          {education.map((item) => {
            const qualification = [item.degree, item.field].filter(Boolean).join(' · ')
            return <article className="public-portfolio-timeline-item" key={item.id}>
              <div><h3>{item.institution}</h3>{qualification && <p>{qualification}</p>}{item.description && <p>{item.description}</p>}</div>
              {(item.startDate || item.endDate) && <p className="public-portfolio-date">{formatRange(item.startDate, item.endDate)}</p>}
            </article>
          })}
        </div>}
      </section>}

      {certificates.length > 0 && <section className="public-portfolio-section" id="certificates" aria-labelledby="certificates-heading">
        <div className="public-portfolio-section-heading"><p className="public-portfolio-kicker">Credentials</p><h2 id="certificates-heading">Certificates</h2></div>
        <div className="public-portfolio-certificate-list">{certificates.map((certificate) => <article className="public-portfolio-certificate" key={certificate.id}>
          <div><h3>{certificate.name}</h3>{certificate.issuer && <p>{certificate.issuer}</p>}</div>
          {certificate.issueDate && <p className="public-portfolio-date">{formatDate(certificate.issueDate)}</p>}
        </article>)}</div>
      </section>}

      {contactLinks.length > 0 && <footer className="public-portfolio-contact" id="contact" aria-labelledby="contact-heading">
        <div><p className="public-portfolio-kicker">Keep in touch</p><h2 id="contact-heading">Contact</h2><p>Find me on the links below.</p></div>
        <div className="public-portfolio-contact-links">{contactLinks.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true">↗</span></a>)}</div>
      </footer>}
    </main>
  )
}

function ProfilePortrait({ imageUrl, name }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (!imageUrl || imageFailed) {
    return <div className="public-portfolio-portrait"><span aria-hidden="true">{getInitials(name)}</span></div>
  }

  return <div className="public-portfolio-portrait"><img src={imageUrl} alt={`${name} profile`} onError={() => setImageFailed(true)} /></div>
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
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

function getExcerpt(value, maxLength) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text

  const sentenceEnd = text.search(/[.!?]\s/)
  if (sentenceEnd > 0 && sentenceEnd < maxLength) return text.slice(0, sentenceEnd + 1)
  return `${text.slice(0, maxLength).trimEnd()}…`
}

function formatRange(startDate, endDate) {
  const start = startDate ? formatDate(startDate) : ''
  const end = endDate ? formatDate(endDate) : 'Present'
  if (!start) return end
  return `${start} — ${end}`
}

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

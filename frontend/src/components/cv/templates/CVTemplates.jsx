import { resolveApiAssetUrl } from '../../../services/api.js'

function Contact({ profile, email }) {
  const items = [email, profile?.phone, profile?.location, profile?.linkedinUrl, profile?.githubUrl, profile?.websiteUrl].filter(Boolean)
  return items.length > 0 && <div className="cv-contact">{items.map((item) => <span key={item}>{item}</span>)}</div>
}

function Header({ data, title, sections }) {
  return <header className="cv-document-header">
    {data.profile?.profileImage && <img className="cv-profile-image" src={resolveApiAssetUrl(data.profile.profileImage)} alt="" />}
    <div className="cv-heading-copy">
      <p className="cv-kicker">{title}</p>
      <h1>{data.user?.name || 'Your name'}</h1>
      {data.profile?.headline && <p className="cv-headline">{data.profile.headline}</p>}
    </div>
    {sections.contact && <Contact profile={data.profile} email={data.user?.email} />}
  </header>
}

function Section({ title, children }) {
  return <section className="cv-section"><h2>{title}</h2>{children}</section>
}

function Summary({ profile }) {
  return profile?.bio && <Section title="Summary"><p>{profile.bio}</p></Section>
}

function Experience({ records }) {
  return records.length > 0 && <Section title="Experience">{records.map((item) => <article className="cv-entry" key={item.id}>
    <div className="cv-entry-top"><div><h3>{item.position || 'Experience'}</h3>{item.company && <p className="cv-entry-subtitle">{item.company}</p>}</div>{dateRange(item.startDate, item.endDate) && <span>{dateRange(item.startDate, item.endDate)}</span>}</div>
    {item.description && <p>{item.description}</p>}
  </article>)}</Section>
}

function Education({ records }) {
  return records.length > 0 && <Section title="Education">{records.map((item) => {
    const heading = item.degree || item.institution || 'Education'
    const subtitle = [item.institution, item.field].filter((value) => value && value !== heading).join(' · ')
    return <article className="cv-entry" key={item.id}>
      <div className="cv-entry-top"><div><h3>{heading}</h3>{subtitle && <p className="cv-entry-subtitle">{subtitle}</p>}</div>{dateRange(item.startDate, item.endDate) && <span>{dateRange(item.startDate, item.endDate)}</span>}</div>
      {item.description && <p>{item.description}</p>}
    </article>
  })}</Section>
}

function Skills({ records }) {
  return records.length > 0 && <Section title="Skills"><ul className="cv-skill-list">{records.map((item) => <li key={item.id}>{item.name}</li>)}</ul></Section>
}

function Projects({ records }) {
  return records.length > 0 && <Section title="Projects">{records.map((item) => <article className="cv-entry" key={item.id}>
    <div className="cv-entry-top"><h3>{item.title || 'Project'}</h3>{item.technologies?.length > 0 && <span>{item.technologies.join(' · ')}</span>}</div>
    {item.description && <p>{item.description}</p>}
    {(item.githubUrl || item.liveUrl) && <p className="cv-links">{[item.githubUrl, item.liveUrl].filter(Boolean).join(' · ')}</p>}
  </article>)}</Section>
}

function Certificates({ records }) {
  return records.length > 0 && <Section title="Certifications">{records.map((item) => <article className="cv-entry compact-entry" key={item.id}>
    <div className="cv-entry-top"><h3>{item.name || 'Certificate'}</h3>{item.issueDate && <span>{formatDate(item.issueDate)}</span>}</div>
    {item.issuer && <p>{item.issuer}{item.credentialUrl ? ` · ${item.credentialUrl}` : ''}</p>}
  </article>)}</Section>
}

function MainSections({ data, sections, order }) {
  const components = {
    summary: <Summary profile={data.profile} />,
    experience: <Experience records={data.experience} />,
    education: <Education records={data.education} />,
    projects: <Projects records={data.projects} />,
    certificates: <Certificates records={data.certificates} />,
    skills: <Skills records={data.skills} />,
  }
  return order.filter((key) => sections[key]).map((key) => <div key={key}>{components[key]}</div>)
}

function getStyle(accent, secondary) {
  return { '--cv-accent': accent, '--cv-secondary': secondary }
}

export function ProfessionalTemplate({ data, sections, title, accent, secondary }) {
  return <article className="cv-document professional-template" style={getStyle(accent, secondary)}>
    <Header data={data} title={title} sections={sections} />
    <MainSections data={data} sections={sections} order={['summary', 'experience', 'education', 'skills', 'projects', 'certificates']} />
  </article>
}

export function ModernTemplate({ data, sections, title, accent, secondary }) {
  return <article className="cv-document modern-template" style={getStyle(accent, secondary)}>
    <aside className="cv-sidebar">
      {data.profile?.profileImage && <img className="cv-profile-image" src={resolveApiAssetUrl(data.profile.profileImage)} alt="" />}
      <h1>{data.user?.name || 'Your name'}</h1>
      {data.profile?.headline && <p className="cv-sidebar-headline">{data.profile.headline}</p>}
      {sections.contact && <Contact profile={data.profile} email={data.user?.email} />}
      {sections.skills && <Skills records={data.skills} />}
    </aside>
    <div className="cv-main-column">
      <p className="cv-kicker">{title}</p>
      <MainSections data={data} sections={{ ...sections, skills: false, contact: false }} order={['summary', 'experience', 'education', 'projects', 'certificates']} />
    </div>
  </article>
}

export function ClassicTemplate({ data, sections, title, accent, secondary }) {
  return <article className="cv-document classic-template" style={getStyle(accent, secondary)}>
    <Header data={data} title={title} sections={sections} />
    <MainSections data={data} sections={sections} order={['summary', 'experience', 'education', 'skills', 'projects', 'certificates']} />
  </article>
}

export function MinimalTemplate({ data, sections, title, accent, secondary }) {
  return <article className="cv-document minimal-template" style={getStyle(accent, secondary)}>
    <Header data={data} title={title} sections={sections} />
    <MainSections data={data} sections={sections} order={['summary', 'experience', 'skills', 'education', 'projects', 'certificates']} />
  </article>
}

export function CreativeTemplate({ data, sections, title, accent, secondary }) {
  return <article className="cv-document creative-template" style={getStyle(accent, secondary)}>
    <Header data={data} title={title} sections={sections} />
    <MainSections data={data} sections={sections} order={['summary', 'skills', 'projects', 'experience', 'education', 'certificates']} />
  </article>
}

function dateRange(start, end) {
  const from = start ? formatDate(start) : ''
  const to = end ? formatDate(end) : (start ? 'Present' : '')
  if (!from) return to
  return `${from} — ${to}`
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
}

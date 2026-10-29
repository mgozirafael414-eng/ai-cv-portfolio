import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { certificatesApi, educationApi, experienceApi, projectsApi, profileApi, skillsApi } from '../../services/api.js'
import { ProfilePage } from '../profile/ProfilePage.jsx'
import { EducationPage } from '../education/EducationPage.jsx'
import { ExperiencePage } from '../experience/ExperiencePage.jsx'
import { SkillsPage } from '../skills/SkillsPage.jsx'
import { ProjectsPage } from '../projects/ProjectsPage.jsx'
import { CertificatesPage } from '../certificates/CertificatesPage.jsx'
import { PortfolioPage } from '../portfolio/PortfolioPage.jsx'
import { CVBuilder } from '../../components/cv/CVBuilder.jsx'
import { AIAssistantPage } from '../ai/AIAssistantPage.jsx'

export function DashboardPage({ page, navigate }) {
  const { user, logout } = useAuth()
  const [mobileNav, setMobileNav] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
    return <div className="dashboard-frame"><aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}><div className="sidebar-top"><p className="brand-mark">Workspace</p><button className="close-nav" onClick={() => setMobileNav(false)}>×</button></div><p className="nav-label">Workspace</p><nav>{[['dashboard','Overview'],['profile','Profile'],['education','Education'],['experience','Experience'],['skills','Skills'],['projects','Projects'],['certificates','Certificates']].map(([key, label]) => <button className={page === key ? 'nav-item active' : 'nav-item'} key={key} onClick={() => { navigate(key === 'dashboard' ? '/dashboard' : `/${key}`); setMobileNav(false) }}>{label}<span>↗</span></button>)}</nav><p className="nav-label secondary-label">Coming later</p><nav>{[['cv-builder','CV Builder'],['ai-assistant','AI Assistant'],['portfolio','Portfolio']].map(([key, label]) => <button className={page === key ? 'nav-item active' : 'nav-item muted'} key={key} onClick={() => { navigate(`/${key}`); setMobileNav(false) }}>{label}<span>○</span></button>)}</nav><button className="logout-button" onClick={logout}>Sign out <span>↗</span></button></aside><main className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}>☰</button><div className="topbar-context">Workspace <span>/</span> {page}</div><div className="profile-menu"><button className="user-chip" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen}><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><span>{user.name}</span></button>{profileMenuOpen && <div className="profile-menu-panel"><strong>{user.name}</strong><small>{user.email}</small><button onClick={() => { navigate('/profile'); setProfileMenuOpen(false) }}>View profile</button><button onClick={logout}>Sign out</button></div>}</div></header><section className="content-area">{page === 'dashboard' ? <><p className="eyebrow">Monday, workspace review</p><h1>Good to see you, {user.name?.split(' ')[0]}.</h1><DashboardOverview navigate={navigate} /></> : <PageContent page={page} navigate={navigate} />}</section></main></div>
}

function DashboardOverview({ navigate, user }) {
  const auth = useAuth()
  const currentUser = user || auth.user
  const [overview, setOverview] = useState(null)
  useEffect(() => { Promise.all([profileApi.get().catch(() => null), educationApi.list(), experienceApi.list(), skillsApi.list(), projectsApi.list(), certificatesApi.list()]).then(([profile, education, experience, skills, projects, certificates]) => setOverview({ profile, education, experience, skills, projects, certificates })).catch(() => setOverview({ profile: null, education: [], experience: [], skills: [], projects: [], certificates: [] })) }, [])
  const values = overview || { profile: null, education: [], experience: [], skills: [], projects: [], certificates: [] }
  const cards = [
    ['Profile', values.profile === null ? '...' : values.profile ? 'Complete' : 'Start here', 'Edit profile', '/profile'],
    ['Education', values.education.length, 'Manage education', '/education'],
    ['Experience', values.experience.length, 'Manage experience', '/experience'],
    ['Skills', values.skills.length, 'Manage skills', '/skills'],
    ['Projects', values.projects.length, 'Manage projects', '/projects'],
    ['Certificates', values.certificates.length, 'Manage certificates', '/certificates'],
  ]
  const firstName = currentUser.name?.trim().split(/\s+/)[0] || 'there'
  return <div className="overview-page"><section className="overview-hero"><div><p className="eyebrow">Workspace overview</p><h1>Good to see you, {firstName}.</h1><p className="overview-title">Your professional story, gathered in one place.</p><p className="overview-description">Connect your profile and career details to prepare a clear, compelling CV.</p></div><div className="overview-status"><span className="status-dot"></span><span>Private workspace</span></div></section><section className="summary-section" aria-label="Professional sections"><div className="section-heading"><div><p className="eyebrow">Your foundation</p><h2>Professional sections</h2></div><span className="section-caption">Keep your source data current</span></div><div className="dashboard-grid">{cards.map(([label, value, action, path]) => <SummaryCard key={label} label={label} value={value} action={action} onClick={() => navigate(path)} />)}</div></section><section className="overview-lower"><div className="snapshot-section"><div className="section-heading"><div><p className="eyebrow">At a glance</p><h2>Professional snapshot</h2></div></div><div className="snapshot-list"><SnapshotItem label="Current focus" value={values.profile?.headline || 'Add a professional headline'} /><SnapshotItem label="Location" value={values.profile?.location || 'Add your location'} /><SnapshotItem label="Profile status" value={values.profile ? 'Profile information available' : 'Profile needs attention'} /></div></div><div className="quick-actions-panel"><div className="section-heading"><div><p className="eyebrow">Next steps</p><h2>Quick actions</h2></div></div><div className="action-list"><ActionButton label="Edit profile" detail="Update your professional information" onClick={() => navigate('/profile')} /><ActionButton label="Add education" detail="Add an academic qualification" onClick={() => navigate('/education')} /><ActionButton label="Add project" detail="Add work to your portfolio" onClick={() => navigate('/projects')} /></div></div></section><section className="continue-section"><div className="section-heading"><div><p className="eyebrow">Continue working</p><h2>Career tools</h2></div></div><div className="tool-links"><ToolLink label="CV Builder" detail="Build and review your professional CV" onClick={() => navigate('/cv-builder')} /><ToolLink label="Portfolio" detail="Manage your public professional presence" onClick={() => navigate('/portfolio')} /><ToolLink label="AI Assistant" detail="Improve your professional content with AI" onClick={() => navigate('/ai-assistant')} /></div></section></div>
}

function SummaryCard({ label, value, action, onClick }) { return <article className="summary-card"><p className="card-label">{label}</p><strong>{value}</strong><button className="card-link" onClick={onClick}>{action} <span aria-hidden="true">→</span></button></article> }
function SnapshotItem({ label, value }) { return <div className="snapshot-item"><span>{label}</span><strong>{value}</strong></div> }
function ActionButton({ label, detail, onClick }) { return <button className="action-button" onClick={onClick}><span><strong>{label}</strong><small>{detail}</small></span><span aria-hidden="true">→</span></button> }
function ToolLink({ label, detail, onClick }) { return <button className="tool-link" onClick={onClick}><strong>{label}</strong><span>{detail}</span><span aria-hidden="true">→</span></button> }
function PageContent({ page, navigate }) { const pages = { profile: <ProfilePage />, education: <EducationPage />, experience: <ExperiencePage />, skills: <SkillsPage />, projects: <ProjectsPage />, certificates: <CertificatesPage />, portfolio: <PortfolioPage navigate={navigate} />, 'cv-builder': <CVBuilder navigate={navigate} />, 'ai-assistant': <AIAssistantPage /> }; return pages[page] || <div className="section-placeholder"><span className="stamp">LATER PHASE</span><h2>{page === 'ai-assistant' ? 'AI Assistant' : 'Portfolio'}</h2><p>This workspace is reserved for a later product phase.</p></div> }

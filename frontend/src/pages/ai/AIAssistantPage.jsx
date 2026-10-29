import { useEffect, useState } from 'react'
import { aiApi, experienceApi, profileApi, projectsApi, skillsApi } from '../../services/api.js'

const emptyData = { profile: null, experience: [], projects: [], skills: [] }

export function AIAssistantPage() {
  const [data, setData] = useState(emptyData)
  const [form, setForm] = useState({ summary: '', jobTitle: '', jobDescription: '' })
  const [selectedExperienceId, setSelectedExperienceId] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [result, setResult] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loadingAction, setLoadingAction] = useState('')
  const [busyRecommendationId, setBusyRecommendationId] = useState('')
  const [editor, setEditor] = useState({ id: '', value: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      profileApi.get().catch((requestError) => requestError.status === 404 ? null : Promise.reject(requestError)),
      experienceApi.list(),
      projectsApi.list(),
      skillsApi.list(),
      aiApi.listRecommendations(),
    ]).then(([profile, experience, projects, skills, storedRecommendations]) => {
      setData({ profile, experience, projects, skills })
      setSelectedExperienceId(experience[0]?.id || '')
      setSelectedProjectId(projects[0]?.id || '')
      setRecommendations(storedRecommendations)
      setForm((current) => ({ ...current, summary: profile?.bio || profile?.headline || '' }))
    }).catch((caught) => setError(getErrorMessage(caught, 'Unable to load your CV data.')))
  }, [])

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  async function runAction(action) {
    setLoadingAction(action)
    setError('')
    try {
      let nextResult
      if (action === 'summary') {
        nextResult = await aiApi.improveSummary({ text: form.summary || data.profile?.bio || data.profile?.headline || 'Professional focused on delivering thoughtful, reliable work.' })
      } else if (action === 'experience') {
        const item = data.experience.find((entry) => entry.id === selectedExperienceId)
        if (!item) throw new Error('Select an experience entry first.')
        nextResult = await aiApi.improveExperience({ experienceId: item.id, description: item.description || '' })
      } else if (action === 'project') {
        const item = data.projects.find((entry) => entry.id === selectedProjectId)
        if (!item) throw new Error('Select a project first.')
        nextResult = await aiApi.improveProject({ projectId: item.id, description: item.description || '' })
      } else if (action === 'skills') {
        nextResult = await aiApi.suggestSkills({ skills: data.skills })
      } else if (action === 'cv') {
        nextResult = await aiApi.optimizeCv({ profile: data.profile || {} })
      } else {
        if (!form.jobTitle.trim() || !form.jobDescription.trim()) throw new Error('Job title and job description are required.')
        nextResult = await aiApi.analyzeJobDescription({ jobTitle: form.jobTitle, description: form.jobDescription, skills: data.skills })
      }
      setResult(nextResult)
      await refreshRecommendations()
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to generate a recommendation right now.'))
    } finally {
      setLoadingAction('')
    }
  }

  async function refreshRecommendations() {
    setRecommendations(await aiApi.listRecommendations())
  }

  async function handleRecommendationAction(action, recommendation) {
    setBusyRecommendationId(recommendation.id)
    setError('')
    try {
      let updatedRecommendation
      if (action === 'accept') {
        updatedRecommendation = await aiApi.acceptRecommendation(recommendation.id, {
          targetType: recommendation.targetType,
          targetId: recommendation.targetId,
          field: recommendation.targetType === 'EXPERIENCE' || recommendation.targetType === 'PROJECT' ? 'description' : 'bio',
        })
      } else if (action === 'reject') {
        updatedRecommendation = await aiApi.rejectRecommendation(recommendation.id)
      } else {
        updatedRecommendation = await aiApi.editRecommendation(recommendation.id, { editedText: editor.value })
      }
      setEditor({ id: '', value: '' })
      setResult((current) => current?.id === recommendation.id ? updatedRecommendation : current)
      await refreshRecommendations()
      if (action === 'accept' && recommendation.targetType) await refreshAffectedData(recommendation.targetType)
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to update this recommendation.'))
    } finally {
      setBusyRecommendationId('')
    }
  }

  async function refreshAffectedData(targetType) {
    if (targetType === 'PROFILE') {
      const profile = await profileApi.get()
      setData((current) => ({ ...current, profile }))
    } else if (targetType === 'EXPERIENCE') {
      const experience = await experienceApi.list()
      setData((current) => ({ ...current, experience }))
    } else if (targetType === 'PROJECT') {
      const projects = await projectsApi.list()
      setData((current) => ({ ...current, projects }))
    } else if (targetType === 'SKILL') {
      const skills = await skillsApi.list()
      setData((current) => ({ ...current, skills }))
    }
  }

  const actionCards = [
    ['summary', 'Professional summary', 'Improve the current profile narrative.'],
    ['experience', 'Experience rewrite', 'Strengthen one owned experience entry.'],
    ['project', 'Project polish', 'Clarify one owned project description.'],
    ['skills', 'Skill suggestions', 'Separate existing skills from evidence-based options.'],
    ['cv', 'CV optimization', 'Review the full stored CV for actionable improvements.'],
    ['job', 'Job match analysis', 'Compare the stored CV with a target role.'],
  ]

  return <div className="resource-page"><div className="resource-toolbar"><div><p className="eyebrow">Review-first AI</p><h2>AI Assistant</h2></div><span className="stamp">APPROVAL REQUIRED</span></div><p className="section-lede">Generate drafts from your saved CV data. Nothing changes until you approve a recommendation.</p>{error && <p className="form-error banner">{error}</p>}<div className="profile-form"><label>Professional summary<textarea rows="4" value={form.summary} onChange={(event) => updateForm('summary', event.target.value)} placeholder="Use your saved profile summary or add a draft." /></label><label>Experience entry<select value={selectedExperienceId} onChange={(event) => setSelectedExperienceId(event.target.value)}><option value="">Select an experience entry</option>{data.experience.map((item) => <option value={item.id} key={item.id}>{item.position} at {item.company}</option>)}</select></label><label>Project<select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}><option value="">Select a project</option>{data.projects.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>Job title<input value={form.jobTitle} onChange={(event) => updateForm('jobTitle', event.target.value)} placeholder="Frontend Developer" /></label><label>Job description<textarea rows="5" value={form.jobDescription} onChange={(event) => updateForm('jobDescription', event.target.value)} placeholder="Paste a role description for comparison." /></label></div><div className="dashboard-grid" style={{ marginTop: '2rem' }}>{actionCards.map(([action, label, description]) => <article className="summary-card" key={action}><p className="card-label">{label}</p><p>{description}</p><button className="card-link" onClick={() => runAction(action)} disabled={Boolean(loadingAction)}>{loadingAction === action ? 'Generating...' : 'Generate suggestion'}</button></article>)}</div>{result && <OutputCard result={result} editor={editor} setEditor={setEditor} busy={busyRecommendationId === result.id} onAction={handleRecommendationAction} />}{recommendations.length > 0 && <div className="profile-form" style={{ marginTop: '2rem' }}><h3>AI Recommendations</h3>{recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} editor={editor} setEditor={setEditor} busy={busyRecommendationId === recommendation.id} onAction={handleRecommendationAction} />)}</div>}</div>
}

function OutputCard({ result, editor, setEditor, busy, onAction }) {
  return <div className="profile-form" style={{ marginTop: '2rem' }}><h3>Latest AI output</h3><p>Status: {result.status || 'PENDING'}</p>{result.status === 'PENDING' && <p className="stamp">APPROVAL REQUIRED</p>}{result.type === 'skill_suggestions' ? <SkillResult result={result} /> : result.type === 'job_analysis' ? <JobResult result={result} /> : <>{result.original && <><p className="card-label">Current summary</p><p>{result.original}</p></>}<p className="card-label">AI draft</p><pre style={{ whiteSpace: 'pre-wrap', background: '#f8f5f1', padding: '1rem', borderRadius: '12px' }}>{formatResult(result)}</pre>{Array.isArray(result.reasoning) && <><p className="card-label">Why this recommendation</p><p>{result.reasoning.join(' ')}</p></>}</>} {result.status === 'PENDING' && <ApprovalActions recommendation={result} editor={editor} setEditor={setEditor} busy={busy} onAction={onAction} />}</div>
}

function ApprovalActions({ recommendation, editor, setEditor, busy, onAction }) {
  return <div className="quick-actions"><button type="button" onClick={() => setEditor({ id: recommendation.id, value: recommendation.suggestion || '' })} disabled={busy}>Edit</button><button type="button" onClick={() => onAction('accept', recommendation)} disabled={busy}>Accept</button><button type="button" onClick={() => onAction('reject', recommendation)} disabled={busy}>Reject</button>{editor.id === recommendation.id && <div style={{ width: '100%' }}><textarea rows="4" value={editor.value} onChange={(event) => setEditor({ id: recommendation.id, value: event.target.value })} /><button type="button" onClick={() => onAction('edit', recommendation)} disabled={busy || !editor.value.trim()}>Save edit</button></div>}</div>
}

function SkillResult({ result }) {
  return <><p className="card-label">Existing skills</p><p>{result.existingSkills?.join(', ') || 'None recorded.'}</p><p className="card-label">Evidence-based suggested skills</p><p>{result.suggestedSkills?.join(', ') || 'No new skills suggested.'}</p></>
}

function JobResult({ result }) {
  return <><p className="card-label">Already supported by CV</p><p>Skills: {result.matchingSkills?.join(', ') || 'None identified.'}</p><p>Experience: {result.relevantExperience?.join(' ') || 'None identified.'}</p><p>Projects: {result.relevantProjects?.join(' ') || 'None identified.'}</p><p className="card-label">Missing or weak evidence</p><p>{result.missingOrNotEvidenced?.join(', ') || 'None identified.'}</p><p className="card-label">Suggested improvements</p><p>{result.suggestions?.join(' ') || 'No additional suggestions.'}</p></>
}

function RecommendationCard({ recommendation, editor, setEditor, busy, onAction }) {
  return <article style={{ borderTop: '1px solid #ddd', paddingTop: '1rem', marginTop: '1rem' }}><p className="card-label">{recommendation.type} | Status: {recommendation.status}</p>{recommendation.type === 'professional_summary' && recommendation.original && <><p className="card-label">Current summary</p><p>{recommendation.original}</p></>}<p className="card-label">AI draft</p>{recommendation.type === 'skill_suggestions' ? <p>{formatStructuredRecommendation(recommendation)}</p> : recommendation.type === 'job_analysis' ? <p>{formatStructuredRecommendation(recommendation)}</p> : <pre style={{ whiteSpace: 'pre-wrap' }}>{recommendation.suggestion}</pre>}{recommendation.status === 'PENDING' && <><button onClick={() => onAction('reject', recommendation)} disabled={busy}>Reject</button><button onClick={() => onAction('accept', recommendation)} disabled={busy}>Accept</button>{recommendation.type !== 'skill_suggestions' && recommendation.type !== 'job_analysis' && <><button onClick={() => setEditor({ id: recommendation.id, value: recommendation.suggestion || '' })} disabled={busy}>Edit</button>{editor.id === recommendation.id && <div><textarea rows="4" value={editor.value} onChange={(event) => setEditor({ id: recommendation.id, value: event.target.value })} /><button onClick={() => onAction('edit', recommendation)} disabled={busy || !editor.value.trim()}>Save edit</button></div>}</>}</>}</article>
}

function formatStructuredRecommendation(recommendation) {
  try {
    const parsed = JSON.parse(recommendation.suggestion)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return recommendation.suggestion
  }
}

function formatResult(result) {
  if (typeof result.suggestion === 'string') return result.suggestion
  const structured = { ...result }
  delete structured.id
  delete structured.userId
  delete structured.type
  delete structured.status
  return JSON.stringify(structured, null, 2)
}

function getErrorMessage(error, fallback) {
  if (!error) return fallback
  if (error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.status === 403) return 'You are not allowed to access this AI resource.'
  if (error.status === 404) return 'The requested CV resource was not found.'
  if (error.status === 422) return error.message || 'The AI request could not be validated.'
  if (error.status === 429) return 'The AI provider is rate-limited. Please try again shortly.'
  if (error.status === 502) return error.message || 'The AI provider returned an invalid response.'
  if (error.status === 503) return error.message || 'The AI provider is currently unavailable.'
  return error.message || fallback
}

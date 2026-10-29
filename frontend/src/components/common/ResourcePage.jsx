import { useEffect, useState } from 'react'
import { ApiError } from '../../services/api.js'

export function ResourcePage({ config }) {
  const [records, setRecords] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ error: '', success: '' })

  const load = async () => {
    setLoading(true)
    try { setRecords(await config.api.list()); setFeedback({ error: '', success: '' }) }
    catch (error) { setFeedback({ error: messageFor(error, `Unable to load ${config.label.toLowerCase()}.`), success: '' }) }
    finally { setLoading(false) }
  }
  // Data loading is intentionally owned by this page so each resource has independent states.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load() }, [config])

  const save = async (values) => {
    if (saving) return
    setSaving(true)
    setFeedback({ error: '', success: '' })
    try {
      const savedRecord = editing?.id
        ? await config.api.update(editing.id, values)
        : await config.api.create(values)
      setRecords((current) => editing?.id
        ? current.map((record) => record.id === editing.id ? savedRecord : record)
        : [savedRecord, ...current])
      setEditing(null)
      setFeedback({ error: '', success: `${config.singular} ${editing ? 'updated' : 'added'}.` })
    } catch (error) { setFeedback({ error: messageFor(error, `Unable to save ${config.singular.toLowerCase()}.`), success: '' }) }
    finally { setSaving(false) }
  }
  const remove = async (record) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}? This cannot be undone.`)) return
    try { await config.api.remove(record.id); setFeedback({ error: '', success: `${config.singular} deleted.` }); await load() }
    catch (error) { setFeedback({ error: messageFor(error, 'Unable to delete this record.'), success: '' }) }
  }

  return <div className="resource-layout"><div className="resource-toolbar"><div><p className="eyebrow">Your records</p><h2>{config.label}</h2></div><button className="primary-button compact" disabled={saving} onClick={() => { setEditing({}); setFeedback({ error: '', success: '' }) }}>+ Add {config.singular}</button></div>{feedback.error && <p className="form-error banner">{feedback.error}</p>}{feedback.success && <p className="form-success banner">{feedback.success}</p>}<div className="resource-columns"><section className="record-list">{loading ? <p className="state-message">Loading {config.label.toLowerCase()}...</p> : records.length === 0 ? <div className="empty-state"><span className="stamp">EMPTY</span><h3>No {config.label.toLowerCase()} yet.</h3><p>Add your first record to make your professional story more complete.</p><button className="text-button" disabled={saving} onClick={() => setEditing({})}>Add {config.singular} ↗</button></div> : records.map((record) => <RecordCard key={record.id} record={record} config={config} onEdit={() => { if (!saving) setEditing(record) }} onDelete={() => remove(record)} disabled={saving} />)}</section>{editing && <ResourceForm key={editing.id || 'new'} config={config} record={editing.id ? editing : null} onSave={save} onCancel={() => setEditing(null)} saving={saving} />}</div></div>
}

function RecordCard({ record, config, onEdit, onDelete, disabled }) {
  return <article className="record-card"><div className="record-card-heading"><div><p className="card-label">{config.cardLabel(record)}</p><h3>{config.cardTitle(record)}</h3></div><div className="record-actions"><button className="icon-button" title="Edit record" onClick={onEdit} disabled={disabled}>Edit</button><button className="icon-button danger" title="Delete record" onClick={onDelete} disabled={disabled}>Delete</button></div></div><p className="record-summary">{config.cardSummary(record)}</p>{config.cardMeta && <div className="record-meta">{config.cardMeta(record)}</div>}</article>
}

function ResourceForm({ config, record, onSave, onCancel, saving }) {
  const [values, setValues] = useState(() => config.toForm(record))
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    const validation = config.validate(values)
    if (validation) { setError(validation); return }
    setError('')
    await onSave(config.toPayload(values))
  }
  return <section className="editor-panel"><div className="editor-heading"><p className="eyebrow">{record ? 'Edit record' : 'New record'}</p><button className="close-editor" onClick={onCancel} disabled={saving}>×</button></div><form className="data-form" onSubmit={submit}>{config.fields.map((field) => <Field key={field.name} field={field} value={values[field.name] ?? ''} onChange={(value) => { setValues((current) => ({ ...current, [field.name]: value })); setError('') }} />)}{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : record ? 'Save changes' : 'Add record'}</button></div></form></section>
}

function Field({ field, value, onChange }) {
  const input = field.type === 'textarea' ? <textarea rows={field.rows || 4} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /> : field.type === 'select' ? <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select one</option>{field.options.map((option) => <option value={option} key={option}>{option}</option>)}</select> : <input type={field.type || 'text'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
  return <label>{field.label}{input}</label>
}

function messageFor(error, fallback) {
  if (!(error instanceof ApiError)) return fallback
  const details = Array.isArray(error.details) ? error.details.filter((detail) => typeof detail === 'string') : []
  return details.length ? `${error.message}: ${details.join('; ')}` : error.message
}

import { useEffect, useState } from 'react'
import { ApiError } from '../../services/api.js'

export function ResourcePage({ config }) {
  const [records, setRecords] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
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
    setFeedback({ error: '', success: '' })
    try {
      if (editing?.id) await config.api.update(editing.id, values)
      else await config.api.create(values)
      setEditing(null)
      setFeedback({ error: '', success: `${config.singular} ${editing ? 'updated' : 'added'}.` })
      await load()
    } catch (error) { setFeedback({ error: messageFor(error, `Unable to save ${config.singular.toLowerCase()}.`), success: '' }) }
  }
  const remove = async (record) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}? This cannot be undone.`)) return
    try { await config.api.remove(record.id); setFeedback({ error: '', success: `${config.singular} deleted.` }); await load() }
    catch (error) { setFeedback({ error: messageFor(error, 'Unable to delete this record.'), success: '' }) }
  }

  return <div className="resource-layout"><div className="resource-toolbar"><div><p className="eyebrow">Your records</p><h2>{config.label}</h2></div><button className="primary-button compact" onClick={() => { setEditing({}); setFeedback({ error: '', success: '' }) }}>+ Add {config.singular}</button></div>{feedback.error && <p className="form-error banner">{feedback.error}</p>}{feedback.success && <p className="form-success banner">{feedback.success}</p>}<div className="resource-columns"><section className="record-list">{loading ? <p className="state-message">Loading {config.label.toLowerCase()}...</p> : records.length === 0 ? <div className="empty-state"><span className="stamp">EMPTY</span><h3>No {config.label.toLowerCase()} yet.</h3><p>Add your first record to make your professional story more complete.</p><button className="text-button" onClick={() => setEditing({})}>Add {config.singular} ↗</button></div> : records.map((record) => <RecordCard key={record.id} record={record} config={config} onEdit={() => setEditing(record)} onDelete={() => remove(record)} />)}</section>{editing && <ResourceForm config={config} record={editing.id ? editing : null} onSave={save} onCancel={() => setEditing(null)} />}</div></div>
}

function RecordCard({ record, config, onEdit, onDelete }) {
  return <article className="record-card"><div className="record-card-heading"><div><p className="card-label">{config.cardLabel(record)}</p><h3>{config.cardTitle(record)}</h3></div><div className="record-actions"><button className="icon-button" title="Edit record" onClick={onEdit}>Edit</button><button className="icon-button danger" title="Delete record" onClick={onDelete}>Delete</button></div></div><p className="record-summary">{config.cardSummary(record)}</p>{config.cardMeta && <div className="record-meta">{config.cardMeta(record)}</div>}</article>
}

function ResourceForm({ config, record, onSave, onCancel }) {
  const [values, setValues] = useState(() => config.toForm(record))
  const [error, setError] = useState('')
  const submit = (event) => {
    event.preventDefault()
    const validation = config.validate(values)
    if (validation) { setError(validation); return }
    onSave(config.toPayload(values))
  }
  return <section className="editor-panel"><div className="editor-heading"><p className="eyebrow">{record ? 'Edit record' : 'New record'}</p><button className="close-editor" onClick={onCancel}>×</button></div><form className="data-form" onSubmit={submit}>{config.fields.map((field) => <Field key={field.name} field={field} value={values[field.name] ?? ''} onChange={(value) => setValues({ ...values, [field.name]: value })} />)}{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit">{record ? 'Save changes' : 'Add record'}</button></div></form></section>
}

function Field({ field, value, onChange }) {
  const input = field.type === 'textarea' ? <textarea rows={field.rows || 4} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} /> : field.type === 'select' ? <select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select one</option>{field.options.map((option) => <option value={option} key={option}>{option}</option>)}</select> : <input type={field.type || 'text'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
  return <label>{field.label}{input}</label>
}

function messageFor(error, fallback) { return error instanceof ApiError ? error.message : fallback }

const dateFields = new Set(['startDate', 'endDate', 'issueDate'])

export function toResourceFormValues(record, fields) {
  if (!record) return {}

  return Object.fromEntries(fields.map((field) => {
    const value = record[field]
    if (dateFields.has(field)) {
      const dateValue = value instanceof Date ? value.toISOString().slice(0, 10) : value
      return [field, typeof dateValue === 'string' ? dateValue.slice(0, 10) : '']
    }

    if (field === 'technologies') {
      return [field, Array.isArray(value) ? value.join(', ') : '']
    }

    return [field, value ?? '']
  }))
}

export function toResourcePayload(values) {
  return Object.fromEntries(Object.entries(values).map(([field, value]) => [
    field,
    dateFields.has(field) && value === '' ? null : value,
  ]))
}

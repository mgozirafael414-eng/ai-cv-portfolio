const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

async function request(path, options = {}) {
  const apiUrl = requireApiUrl()
  const token = localStorage.getItem('cv_auth_token')
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${apiUrl}${path}`, { ...options, headers })
  if (response.status === 401) {
    window.dispatchEvent(new Event('cv:unauthorized'))
  }

  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(body.error || 'Something went wrong.', response.status, body.details || [])
  }
  return body
}

const json = (method, path, payload) => request(path, { method, body: JSON.stringify(payload) })
const resourceApi = (path, key) => ({
  list: async () => (await request(path))[key],
  create: async (payload) => (await json('POST', path, payload))[key.slice(0, -1)],
  update: async (id, payload) => (await json('PUT', `${path}/${id}`, payload))[key.slice(0, -1)],
  remove: (id) => request(`${path}/${id}`, { method: 'DELETE' }),
})

export const authApi = {
  register: (payload) => json('POST', '/api/auth/register', payload),
  login: (payload) => json('POST', '/api/auth/login', payload),
  currentUser: async () => (await request('/api/auth/me')).user,
}

export const profileApi = {
  get: async () => (await request('/api/profile')).profile,
  update: async (payload) => (await json('PUT', '/api/profile', payload)).profile,
  uploadImage: async (file) => {
    const apiUrl = requireApiUrl()
    const token = localStorage.getItem('cv_auth_token')
    const formData = new FormData()
    formData.append('image', file)
    const response = await fetch(`${apiUrl}/api/profile/image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData })
    if (response.status === 401) window.dispatchEvent(new Event('cv:unauthorized'))
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(body.error || 'Unable to upload profile picture.', response.status, body.details || [])
    return body.profile
  },
  removeImage: async () => {
    const body = await request('/api/profile/image', { method: 'DELETE' })
    return body.profile
  },
}

export const educationApi = resourceApi('/api/education', 'educations')
export const experienceApi = resourceApi('/api/experience', 'experiences')
export const skillsApi = resourceApi('/api/skills', 'skills')
export const projectsApi = resourceApi('/api/projects', 'projects')
export const certificatesApi = resourceApi('/api/certificates', 'certificates')

export const portfolioApi = {
  get: async () => (await request('/api/portfolio')).portfolio,
  create: async (payload) => (await json('POST', '/api/portfolio', payload)).portfolio,
  update: async (payload) => (await json('PUT', '/api/portfolio', payload)).portfolio,
  publish: async (isPublished) => (await json('PATCH', '/api/portfolio/publish', { isPublished })).portfolio,
  getPublic: async (slug) => (await request(`/api/public/portfolio/${encodeURIComponent(slug)}`)).portfolio,
}

export const aiApi = {
  listRecommendations: async () => (await request('/api/ai/recommendations')).recommendations,
  getRecommendation: async (id) => (await request(`/api/ai/recommendations/${encodeURIComponent(id)}`)).recommendation,
  acceptRecommendation: async (id, payload = {}) => (await json('POST', `/api/ai/recommendations/${encodeURIComponent(id)}/accept`, payload)).recommendation,
  rejectRecommendation: async (id) => (await json('POST', `/api/ai/recommendations/${encodeURIComponent(id)}/reject`, {})).recommendation,
  editRecommendation: async (id, payload = {}) => (await json('POST', `/api/ai/recommendations/${encodeURIComponent(id)}/edit`, payload)).recommendation,
  improveSummary: async (payload) => json('POST', '/api/ai/improve-summary', payload),
  improveExperience: async (payload) => json('POST', '/api/ai/improve-experience', payload),
  improveProject: async (payload) => json('POST', '/api/ai/improve-project', payload),
  suggestSkills: async (payload) => json('POST', '/api/ai/suggest-skills', payload),
  optimizeCv: async (payload) => json('POST', '/api/ai/optimize-cv', payload),
  analyzeJobDescription: async (payload) => json('POST', '/api/ai/analyze-job-description', payload),
}

export const cvPdfApi = {
  download: async (settings = {}) => {
    const apiUrl = requireApiUrl()
    const token = localStorage.getItem('cv_auth_token')
    const query = new URLSearchParams({
      template: settings.template || 'professional',
      colorPreset: settings.colorPreset || 'navy',
      title: settings.title || 'Professional CV',
      sections: Object.entries(settings.sections || {}).filter(([, visible]) => visible).map(([name]) => name).join(','),
    })
    const response = await fetch(`${apiUrl}/api/cv/pdf?${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (response.status === 401) {
      window.dispatchEvent(new Event('cv:unauthorized'))
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const message = import.meta.env.DEV
        ? `PDF request failed: ${response.status}${body.error ? ` - ${body.error}` : ''}`
        : (body.error || 'Unable to generate CV PDF.')
      throw new ApiError(message, response.status, body.details || [])
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition') || ''
    const match = contentDisposition.match(/filename\s*=\s*"?([^";]+)"?/) || []
    const filename = match[1] ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'cv.pdf'
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    return { filename }
  },
}

function requireApiUrl() {
  if (!API_URL) {
    throw new ApiError('VITE_API_URL is required for the deployed frontend.', 0)
  }
  return API_URL
}

export function clearAuth() {
  localStorage.removeItem('cv_auth_token')
  localStorage.removeItem('cv_auth_user')
}

export function resolveApiAssetUrl(value) {
  if (!value || value.startsWith('http://') || value.startsWith('https://')) return value
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`
}

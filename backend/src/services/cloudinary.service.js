import { createHash, randomUUID } from 'node:crypto'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 10_000
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function getCloudinaryCredentials() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  }
}

export function hasCloudinaryConfiguration() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials()
  return Boolean(cloudName && apiKey && apiSecret)
}

export function hasPartialCloudinaryConfiguration() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials()
  return Boolean(cloudName || apiKey || apiSecret) && !hasCloudinaryConfiguration()
}

function getCloudinaryConfig() {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials()
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Persistent profile image storage is not configured.')
    error.statusCode = process.env.NODE_ENV === 'production' ? 503 : 500
    throw error
  }
  return { cloudName, apiKey, apiSecret }
}

function signParameters(parameters, apiSecret) {
  const value = Object.entries(parameters)
    .filter(([, parameter]) => parameter !== undefined && parameter !== null && parameter !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, parameter]) => `${key}=${parameter}`)
    .join('&')
  return createHash('sha1').update(`${value}${apiSecret}`).digest('hex')
}

function getCloudinaryPublicId(imageUrl, cloudName) {
  try {
    const url = new URL(imageUrl)
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || url.search || url.hash) return null
    if (!cloudName) return null
    const prefix = `/${cloudName}/image/upload/`
    if (!url.pathname.startsWith(prefix)) return null

    const segments = url.pathname.slice(prefix.length).split('/')
    if (/^(?:[a-z]_[^/]+)(?:,[a-z]_[^/]+)*$/.test(segments[0])) segments.shift()
    if (/^v\d+$/.test(segments[0])) segments.shift()
    if (!segments.length) return null
    segments[segments.length - 1] = segments.at(-1).replace(/\.[^.]+$/, '')
    const publicId = segments.join('/')
    return publicId && !publicId.includes('..') ? publicId : null
  } catch {
    return null
  }
}

export function isCloudinaryImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') return false
  const { CLOUDINARY_CLOUD_NAME: cloudName } = process.env
  if (cloudName) return getCloudinaryPublicId(imageUrl, cloudName) !== null
  try {
    const url = new URL(imageUrl)
    return url.protocol === 'https:'
      && url.hostname === 'res.cloudinary.com'
      && !url.username
      && !url.password
      && /^\/[^/]+\/image\/upload\/.+/.test(url.pathname)
  } catch {
    return false
  }
}

async function cloudinaryRequest(resource, formData) {
  let response
  try {
    response = await fetch(resource, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    const error = new Error('Persistent image storage is unavailable or timed out.')
    error.statusCode = 502
    throw error
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    const error = new Error('Persistent image storage request failed.')
    error.statusCode = 502
    throw error
  }
  return body
}

export async function uploadProfileImageToCloudinary(file, userId) {
  if (!file?.buffer || file.buffer.length > MAX_IMAGE_BYTES || !IMAGE_TYPES.has(file.mimetype)) {
    const error = new Error('Invalid profile image for persistent storage.')
    error.statusCode = 400
    throw error
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const format = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
  const parameters = {
    folder: 'profile-images',
    public_id: `${userId}-${randomUUID()}`,
    timestamp: Math.floor(Date.now() / 1000),
  }
  const formData = new FormData()
  formData.append('file', new Blob([file.buffer], { type: file.mimetype }), `profile.${format}`)
  formData.append('api_key', apiKey)
  for (const [key, value] of Object.entries(parameters)) formData.append(key, String(value))
  formData.append('signature', signParameters(parameters, apiSecret))

  const body = await cloudinaryRequest(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, formData)
  if (
    typeof body.secure_url !== 'string'
    || typeof body.public_id !== 'string'
    || getCloudinaryPublicId(body.secure_url, cloudName) !== body.public_id
  ) {
    const error = new Error('Persistent image storage returned an invalid image reference.')
    error.statusCode = 502
    throw error
  }
  return { url: body.secure_url, publicId: body.public_id }
}

export function createProfileImageUploadSignature(userId) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const parameters = {
    folder: 'profile-images',
    public_id: `${userId}-${randomUUID()}`,
    timestamp: Math.floor(Date.now() / 1000),
  }
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    cloudName,
    apiKey,
    parameters,
    signature: signParameters(parameters, apiSecret),
  }
}

export async function verifyCloudinaryProfileImage(upload, userId) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const { secure_url: secureUrl, public_id: publicId, format, bytes } = upload || {}
  const allowedFormats = new Set(['jpg', 'jpeg', 'png', 'webp'])
  if (
    typeof publicId !== 'string'
    || !publicId.startsWith(`profile-images/${userId}-`)
    || !allowedFormats.has(format)
    || !Number.isInteger(bytes)
    || bytes <= 0
    || bytes > MAX_IMAGE_BYTES
    || typeof secureUrl !== 'string'
    || getCloudinaryPublicId(secureUrl, cloudName) !== publicId
  ) {
    const error = new Error('Cloudinary returned invalid profile image details.')
    error.statusCode = 400
    throw error
  }

  const encodedPublicId = publicId.split('/').map(encodeURIComponent).join('/')
  let response
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/image/upload/${encodedPublicId}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    const error = new Error('Persistent image storage is unavailable or timed out.')
    error.statusCode = 502
    throw error
  }
  const asset = await response.json().catch(() => ({}))
  if (
    !response.ok
    || asset.public_id !== publicId
    || asset.secure_url !== secureUrl
    || asset.format !== format
    || asset.bytes !== bytes
  ) {
    const error = new Error('The uploaded image could not be verified with persistent storage.')
    error.statusCode = 502
    throw error
  }
  return { url: asset.secure_url, publicId: asset.public_id }
}

export async function deleteProfileImageFromCloudinary(imageUrl, userId) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig()
  const publicId = getCloudinaryPublicId(imageUrl, cloudName)
  if (!publicId || !publicId.startsWith(`profile-images/${userId}-`)) return false

  const parameters = {
    invalidate: 'true',
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
  }
  const formData = new FormData()
  formData.append('api_key', apiKey)
  for (const [key, value] of Object.entries(parameters)) formData.append(key, String(value))
  formData.append('signature', signParameters(parameters, apiSecret))

  const body = await cloudinaryRequest(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, formData)
  if (!['ok', 'not found'].includes(body.result)) {
    const error = new Error('Persistent image storage could not delete the profile image.')
    error.statusCode = 502
    throw error
  }
  return true
}

export function getCloudinaryImageFetchUrl(imageUrl) {
  return isCloudinaryImageUrl(imageUrl) ? imageUrl : null
}

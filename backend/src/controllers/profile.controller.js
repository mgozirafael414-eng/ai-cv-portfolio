import {
  getProfileByUserId,
  removeProfileImageForUser,
  replaceProfileImageForUser,
  upsertProfileForUser,
} from '../services/profile.service.js'
import { validateProfileInput } from '../utils/profile.validation.js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024

function hasValidImageSignature(file) {
  const bytes = file?.buffer
  if (!bytes) return false

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isWebp = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  return isJpeg || isPng || isWebp
}

export async function getCurrentProfile(request, response, next) {
  try {
    const profile = await getProfileByUserId(request.userId)
    if (!profile) {
      return response.status(404).json({ error: 'Profile not found' })
    }

    return response.json({ profile })
  } catch (error) {
    return next(error)
  }
}

export async function upsertCurrentProfile(request, response, next) {
  const { errors, data } = validateProfileInput(request.body)
  if (errors.length) {
    return response.status(400).json({ error: 'Validation failed', details: errors })
  }

  try {
    const existingProfile = await getProfileByUserId(request.userId)
    const profile = await upsertProfileForUser(request.userId, data)

    return response.status(existingProfile ? 200 : 201).json({ profile })
  } catch (error) {
    return next(error)
  }
}

export async function uploadCurrentProfileImage(request, response, next) {
  try {
    const validMimeType = ['image/jpeg', 'image/png', 'image/webp'].includes(request.file?.mimetype)
    if (!request.file || request.file.size > MAX_PROFILE_IMAGE_BYTES || !validMimeType || !hasValidImageSignature(request.file)) {
      return response.status(400).json({ error: 'Upload a valid JPG, PNG, or WEBP image up to 5 MB.' })
    }

    const extension = request.file.mimetype === 'image/png' ? 'png' : request.file.mimetype === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${request.userId}-${Date.now()}.${extension}`
    const imagePath = `/uploads/profile-images/${filename}`
    const previousProfile = await getProfileByUserId(request.userId)
    const directory = path.resolve(process.cwd(), 'uploads/profile-images')
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, filename), request.file.buffer)
    const profile = await replaceProfileImageForUser(request.userId, imagePath, previousProfile?.profileImage)
    return response.json({ profile })
  } catch (error) {
    return next(error)
  }
}

export async function removeCurrentProfileImage(request, response, next) {
  try {
    const profile = await removeProfileImageForUser(request.userId)
    if (!profile) return response.status(404).json({ error: 'Profile not found' })
    return response.json({ profile })
  } catch (error) {
    return next(error)
  }
}

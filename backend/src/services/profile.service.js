import { prisma } from '../config/prisma.js'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { deleteProfileImageFromCloudinary, isCloudinaryImageUrl } from './cloudinary.service.js'

export function getProfileByUserId(userId) {
  return prisma.profile.findUnique({ where: { userId } })
}

export function upsertProfileForUser(userId, profileData) {
  // Explicitly exclude any client-supplied userId from the profile data.
  // The profile's owner is always the authenticated JWT user, not a value
  // the client could inject through the request body.
  const { userId: _ignored, ...safeData } = profileData
  return prisma.profile.upsert({
    where: { userId },
    create: { userId, ...safeData },
    update: safeData,
  })
}

export async function replaceProfileImageForUser(userId, imagePath, previousImagePath) {
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, profileImage: imagePath },
    update: { profileImage: imagePath },
  })

  try {
    await removeStoredProfileImage(previousImagePath, userId)
  } catch (error) {
    console.error('Unable to remove the previous profile image after replacement:', error.message)
  }
  return profile
}

export async function removeProfileImageForUser(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) return null

  const updatedProfile = await prisma.profile.update({
    where: { userId },
    data: { profileImage: null },
  })
  try {
    await removeStoredProfileImage(profile.profileImage, userId)
  } catch (error) {
    error.statusCode = error.statusCode || 502
    error.message = 'The profile image was removed from your profile, but storage cleanup failed.'
    throw error
  }
  return updatedProfile
}

async function removeStoredProfileImage(imagePath, userId) {
  if (isCloudinaryImageUrl(imagePath)) {
    await deleteProfileImageFromCloudinary(imagePath, userId)
    return
  }
  if (!/^\/uploads\/profile-images\/[a-zA-Z0-9._-]+$/.test(imagePath || '')) return
  const filePath = path.resolve(process.cwd(), `.${imagePath}`)
  try {
    await unlink(filePath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

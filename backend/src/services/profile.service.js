import { prisma } from '../config/prisma.js'
import { unlink } from 'node:fs/promises'
import path from 'node:path'

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

  await removeStoredProfileImage(previousImagePath)
  return profile
}

export async function removeProfileImageForUser(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } })
  if (!profile) return null

  const updatedProfile = await prisma.profile.update({
    where: { userId },
    data: { profileImage: null },
  })
  await removeStoredProfileImage(profile.profileImage)
  return updatedProfile
}

async function removeStoredProfileImage(imagePath) {
  if (!imagePath?.startsWith('/uploads/profile-images/')) return
  const filePath = path.resolve(process.cwd(), `.${imagePath}`)
  try {
    await unlink(filePath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

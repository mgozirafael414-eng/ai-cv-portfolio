import { prisma } from '../config/prisma.js'

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function getPortfolioByUserId(userId) {
  return prisma.portfolio.findFirst({ where: { userId } })
}

export async function getPortfolioBySlug(slug) {
  return prisma.portfolio.findUnique({ where: { slug } })
}

export async function createPortfolioForUser(userId, data) {
  const rawSlug = data.slug || slugify(data.title)
  const slug = rawSlug || 'portfolio'
  const existing = await prisma.portfolio.findUnique({ where: { slug } })
  if (existing) {
    const error = new Error('A portfolio with this slug already exists')
    error.statusCode = 409
    throw error
  }

  return prisma.portfolio.create({
    data: {
      userId,
      title: data.title,
      slug,
      template: data.template || 'professional',
      isPublished: Boolean(data.isPublished),
    },
  })
}

export async function updatePortfolioForUser(userId, data) {
  const existing = await prisma.portfolio.findFirst({ where: { userId } })
  if (!existing) {
    const error = new Error('Portfolio not found')
    error.statusCode = 404
    throw error
  }

  const nextData = { ...data }
  if (nextData.slug) {
    const normalizedSlug = slugify(nextData.slug)
    if (!normalizedSlug) {
      const error = new Error('slug is required')
      error.statusCode = 400
      throw error
    }
    if (normalizedSlug !== existing.slug) {
      const taken = await prisma.portfolio.findUnique({ where: { slug: normalizedSlug } })
      if (taken) {
        const error = new Error('A portfolio with this slug already exists')
        error.statusCode = 409
        throw error
      }
    }
    nextData.slug = normalizedSlug
  }

  return prisma.portfolio.update({
    where: { id: existing.id },
    data: nextData,
  })
}

export async function publishPortfolioForUser(userId, isPublished) {
  const existing = await prisma.portfolio.findFirst({ where: { userId } })
  if (!existing) {
    const error = new Error('Portfolio not found')
    error.statusCode = 404
    throw error
  }

  return prisma.portfolio.update({
    where: { id: existing.id },
    data: { isPublished: Boolean(isPublished) },
  })
}

export async function getPublicPortfolioBySlug(slug) {
  return prisma.portfolio.findUnique({
    where: { slug },
    include: {
      user: {
        include: {
          profile: true,
          education: { orderBy: { startDate: 'desc' } },
          experience: { orderBy: { startDate: 'desc' } },
          skills: { orderBy: { name: 'asc' } },
          projects: { orderBy: { createdAt: 'desc' } },
          certificates: { orderBy: { issueDate: 'desc' } },
        },
      },
    },
  })
}

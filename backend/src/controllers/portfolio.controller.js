import { getPortfolioByUserId, getPublicPortfolioBySlug, publishPortfolioForUser, createPortfolioForUser, updatePortfolioForUser } from '../services/portfolio.service.js'
import { prisma } from '../config/prisma.js'
import { validatePortfolioInput } from '../utils/portfolio.validation.js'

function safePortfolioRecord(portfolio) {
  if (!portfolio) return null

  return {
    id: portfolio.id,
    userId: portfolio.userId,
    title: portfolio.title,
    slug: portfolio.slug,
    template: portfolio.template,
    isPublished: portfolio.isPublished,
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt,
  }
}

export async function getCurrentPortfolio(request, response, next) {
  try {
    const portfolio = await getPortfolioByUserId(request.userId)
    if (!portfolio) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    return response.json({ portfolio: safePortfolioRecord(portfolio) })
  } catch (error) {
    return next(error)
  }
}

export async function createCurrentPortfolio(request, response, next) {
  const { errors, data } = validatePortfolioInput(request.body)
  if (errors.length) {
    return response.status(400).json({ error: 'Validation failed', details: errors })
  }

  try {
    const existing = await getPortfolioByUserId(request.userId)
    if (existing) {
      return response.status(409).json({ error: 'Portfolio already exists for this user' })
    }

    const portfolio = await createPortfolioForUser(request.userId, data)
    return response.status(201).json({ portfolio: safePortfolioRecord(portfolio) })
  } catch (error) {
    return next(error)
  }
}

export async function updateCurrentPortfolio(request, response, next) {
  const { errors, data } = validatePortfolioInput(request.body, { partial: true })
  if (errors.length) {
    return response.status(400).json({ error: 'Validation failed', details: errors })
  }

  try {
    const portfolio = await updatePortfolioForUser(request.userId, data)
    return response.json({ portfolio: safePortfolioRecord(portfolio) })
  } catch (error) {
    return next(error)
  }
}

export async function publishCurrentPortfolio(request, response, next) {
  const { isPublished } = request.body ?? {}
  if (typeof isPublished !== 'boolean') {
    return response.status(400).json({ error: 'Validation failed', details: ['isPublished must be a boolean'] })
  }

  try {
    const portfolio = await publishPortfolioForUser(request.userId, isPublished)
    return response.json({ portfolio: safePortfolioRecord(portfolio) })
  } catch (error) {
    return next(error)
  }
}

export async function getPublicPortfolio(request, response, next) {
  try {
    // Reject slugs that exceed the schema maximum (160 chars) before hitting Prisma.
    const slug = request.params.slug
    if (!slug || typeof slug !== 'string' || slug.length > 160) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    const portfolio = await getPublicPortfolioBySlug(slug)
    if (!portfolio || !portfolio.isPublished) {
      return response.status(404).json({ error: 'Portfolio not found' })
    }

    const user = portfolio.user
    const safeUser = user
      ? {
          id: user.id,
          name: user.name,
          profile: user.profile,
          education: user.education,
          experience: user.experience,
          skills: user.skills,
          projects: user.projects,
          certificates: user.certificates,
        }
      : null

    return response.json({
      portfolio: {
        id: portfolio.id,
        title: portfolio.title,
        slug: portfolio.slug,
        template: portfolio.template,
        isPublished: portfolio.isPublished,
        user: safeUser,
      },
    })
  } catch (error) {
    return next(error)
  }
}

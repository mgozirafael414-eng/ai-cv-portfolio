import {
  acceptRecommendationForUser,
  analyzeJobDescription as analyzeDescription,
  editRecommendationForUser,
  getRecommendationForUser,
  improveExperience as improveExperienceSuggestion,
  improveProject as improveProjectSuggestion,
  improveSummary as improveSummarySuggestion,
  listRecommendationsForUser,
  optimizeCv as optimizeCvSuggestion,
  rejectRecommendationForUser,
  suggestSkills as suggestSkillsSuggestion,
} from '../services/ai/ai.service.js'
import {
  validateAiTextInput,
  validateCvOptimizationInput,
  validateExperienceAiInput,
  validateJobAnalysisInput,
  validateProjectAiInput,
  validateSkillSuggestionInput,
} from '../utils/ai.validation.js'
import { isUuid } from '../utils/cv.validation.js'

// Shared guard: reject non-UUID recommendation IDs before they reach Prisma.
function requireRecommendationId(request, response) {
  if (!isUuid(request.params.id)) {
    response.status(400).json({ error: 'Invalid recommendation id' })
    return false
  }
  return true
}

export const aiController = {
  async listRecommendations(request, response, next) {
    try {
      const recommendations = await listRecommendationsForUser(request.userId)
      return response.json({ success: true, recommendations })
    } catch (error) {
      return next(error)
    }
  },

  async getRecommendation(request, response, next) {
    if (!requireRecommendationId(request, response)) return
    try {
      const recommendation = await getRecommendationForUser(request.userId, request.params.id)
      return response.json({ success: true, recommendation })
    } catch (error) {
      return next(error)
    }
  },

  async acceptRecommendation(request, response, next) {
    if (!requireRecommendationId(request, response)) return
    try {
      const recommendation = await acceptRecommendationForUser(request.userId, request.params.id, request.body ?? {})
      return response.json({ success: true, recommendation: recommendation.recommendation })
    } catch (error) {
      return next(error)
    }
  },

  async rejectRecommendation(request, response, next) {
    if (!requireRecommendationId(request, response)) return
    try {
      const recommendation = await rejectRecommendationForUser(request.userId, request.params.id)
      return response.json({ success: true, recommendation: recommendation.recommendation })
    } catch (error) {
      return next(error)
    }
  },

  async editRecommendation(request, response, next) {
    if (!requireRecommendationId(request, response)) return
    const body = request.body ?? {}
    const editedText = typeof body.editedText === 'string' ? body.editedText : ''
    if (!editedText.trim()) {
      return response.status(422).json({ error: 'Validation failed', details: ['editedText is required'] })
    }

    try {
      const recommendation = await editRecommendationForUser(request.userId, request.params.id, editedText)
      return response.json({ success: true, recommendation: recommendation.recommendation })
    } catch (error) {
      return next(error)
    }
  },

  async improveSummary(request, response, next) {
    const { errors, data } = validateAiTextInput(request.body, 'text')
    if (errors.length) {
      return response.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const result = await improveSummarySuggestion(request.userId, data.text)
      return response.json(result)
    } catch (error) {
      return next(error)
    }
  },

  async improveExperience(request, response, next) {
    const { errors, data } = validateExperienceAiInput(request.body)
    if (errors.length) {
      return response.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const result = await improveExperienceSuggestion(request.userId, data.experienceId, data.description)
      return response.json(result)
    } catch (error) {
      return next(error)
    }
  },

  async improveProject(request, response, next) {
    const { errors, data } = validateProjectAiInput(request.body)
    if (errors.length) {
      return response.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const result = await improveProjectSuggestion(request.userId, data.projectId, data.description)
      return response.json(result)
    } catch (error) {
      return next(error)
    }
  },

  async suggestSkills(request, response, next) {
    const { errors, data } = validateSkillSuggestionInput(request.body)
    if (errors.length) {
      return response.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const result = await suggestSkillsSuggestion(request.userId, data.experience, data.projects, data.skills)
      return response.json(result)
    } catch (error) {
      return next(error)
    }
  },

  async optimizeCv(request, response, next) {
    const { errors, data } = validateCvOptimizationInput(request.body)
    if (errors.length) {
      return response.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const result = await optimizeCvSuggestion(request.userId, data.profile, data.experience, data.projects, data.skills)
      return response.json(result)
    } catch (error) {
      return next(error)
    }
  },

  async analyzeJobDescription(request, response, next) {
    const { errors, data } = validateJobAnalysisInput(request.body)
    if (errors.length) {
      return response.status(400).json({ error: 'Validation failed', details: errors })
    }

    try {
      const result = await analyzeDescription(request.userId, data.jobTitle, data.description, data.skills)
      return response.json(result)
    } catch (error) {
      return next(error)
    }
  },
}

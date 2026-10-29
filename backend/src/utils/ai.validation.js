import { isUuid } from './cv.validation.js'

const JOB_TITLE_MAX = 200
const JOB_DESCRIPTION_MAX = 20000

export function validateAiTextInput(input, field = 'text') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'] }
  }

  const value = input[field]
  if (typeof value !== 'string' || !value.trim()) {
    return { errors: [`${field} is required`] }
  }

  if (value.trim().length > 20000) {
    return { errors: [`${field} must be 20000 characters or fewer`] }
  }

  return { errors: [], data: { [field]: value.trim() } }
}

export function validateExperienceAiInput(input) {
  const result = validateAiTextInput(input, 'description')
  if (result.errors.length) return result

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'] }
  }

  const experienceId = input.experienceId
  if (typeof experienceId !== 'string' || !experienceId.trim()) {
    return { errors: ['experienceId is required'] }
  }

  // Validate UUID format before it reaches Prisma's UUID column.
  if (!isUuid(experienceId.trim())) {
    return { errors: ['experienceId must be a valid UUID'] }
  }

  return { errors: [], data: { experienceId: experienceId.trim(), description: result.data.description } }
}

export function validateProjectAiInput(input) {
  const result = validateAiTextInput(input, 'description')
  if (result.errors.length) return result

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'] }
  }

  const projectId = input.projectId
  if (typeof projectId !== 'string' || !projectId.trim()) {
    return { errors: ['projectId is required'] }
  }

  // Validate UUID format before it reaches Prisma's UUID column.
  if (!isUuid(projectId.trim())) {
    return { errors: ['projectId must be a valid UUID'] }
  }

  return { errors: [], data: { projectId: projectId.trim(), description: result.data.description } }
}

export function validateSkillSuggestionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'] }
  }

  if (!Array.isArray(input.experience) && !Array.isArray(input.projects) && !Array.isArray(input.skills)) {
    return { errors: ['experience, projects, or skills is required'] }
  }

  return { errors: [], data: input }
}

export function validateCvOptimizationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'] }
  }

  if (!input.profile && !Array.isArray(input.experience) && !Array.isArray(input.projects) && !Array.isArray(input.skills)) {
    return { errors: ['profile, experience, projects, or skills is required'] }
  }

  return { errors: [], data: input }
}

export function validateJobAnalysisInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'] }
  }

  const jobTitle = typeof input.jobTitle === 'string' ? input.jobTitle.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  if (!jobTitle || !description) {
    return { errors: ['jobTitle and description are required'] }
  }

  // Enforce length limits so oversized input cannot be forwarded to the AI provider.
  if (jobTitle.length > JOB_TITLE_MAX) {
    return { errors: [`jobTitle must be ${JOB_TITLE_MAX} characters or fewer`] }
  }
  if (description.length > JOB_DESCRIPTION_MAX) {
    return { errors: [`description must be ${JOB_DESCRIPTION_MAX} characters or fewer`] }
  }

  if (!Array.isArray(input.skills)) {
    return { errors: ['skills is required'] }
  }

  return { errors: [], data: { jobTitle, description, skills: input.skills } }
}

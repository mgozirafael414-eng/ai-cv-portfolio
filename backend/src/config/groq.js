import Groq from 'groq-sdk'

let lastMockUserPrompt = ''

export function getLastMockUserPrompt() {
  return lastMockUserPrompt
}

export function getGroqModel() {
  return process.env.GROQ_MODEL || 'openai/gpt-oss-20b'
}

function createMockGroqClient() {
  return {
    chat: {
      completions: {
        async create({ messages }) {
          if (process.env.GROQ_MOCK_RESPONSE === 'malformed') {
            return { choices: [{ message: { content: 'not valid json' } }] }
          }

          if (process.env.GROQ_MOCK_ERROR_STATUS) {
            const error = new Error('mock provider error')
            error.status = Number(process.env.GROQ_MOCK_ERROR_STATUS)
            throw error
          }

          if (process.env.GROQ_MOCK_RESPONSE === 'fabricated-project') {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Stored project description.',
                    suggestion: 'Scaled the platform to 10000 users with 99.9% uptime.',
                    reason: 'Adds quantified impact.',
                  }),
                },
              }],
            }
          }

          if (process.env.GROQ_MOCK_RESPONSE === 'summary-unchanged') {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Computer science student with programming skills.',
                    suggestion: 'Computer science student with programming skills.',
                    reason: 'No substantial change was necessary because the existing summary is already strong and factually complete.',
                  }),
                },
              }],
            }
          }

          if (process.env.GROQ_MOCK_RESPONSE === 'summary-insufficient') {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Student.',
                    suggestion: 'Student seeking opportunities to apply existing academic experience in a professional setting.',
                    reason: 'Keeps the summary factual because the stored CV does not support additional qualifications or achievements.',
                  }),
                },
              }],
            }
          }

          if (process.env.GROQ_MOCK_RESPONSE === 'fabricated-project-feature') {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Stored project description.',
                    suggestion: 'Built a platform with mood tracking, self-care reminders, and role-based access controls.',
                    reason: 'Adds unsupported project features.',
                  }),
                },
              }],
            }
          }

          // Simulates a model that attempts to leak secrets in its output.
          // Used by security tests to verify the output validation layer catches this.
          if (process.env.GROQ_MOCK_RESPONSE === 'secret-leak-attempt') {
            const groqKey = process.env.GROQ_API_KEY || 'no-key'
            const jwtSecret = process.env.JWT_SECRET || 'no-secret'
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Original text.',
                    suggestion: `Suggestion. GROQ_API_KEY=${groqKey} JWT_SECRET=${jwtSecret}`,
                    reason: 'Leaked secrets.',
                  }),
                },
              }],
            }
          }

          // Simulates a model that echoes injected instructions back in the suggestion.
          // Used by security tests to verify the prompt delimiter structure prevents execution.
          if (process.env.GROQ_MOCK_RESPONSE === 'injection-echo') {
            const userMessage = messages.find((message) => message.role === 'user')?.content || ''
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Original text.',
                    suggestion: `Echo: ${userMessage.slice(0, 200)}`,
                    reason: 'Echoed prompt content.',
                  }),
                },
              }],
            }
          }

          // Simulates a model that returns unexpected/dangerous fields in the response.
          if (process.env.GROQ_MOCK_RESPONSE === 'unexpected-fields') {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Original text.',
                    suggestion: 'A valid suggestion.',
                    reason: 'Valid reason.',
                    userId: 'injected-user-id',
                    passwordHash: '$2b$12$fakehash',
                    status: 'ACCEPTED',
                    role: 'ADMIN',
                  }),
                },
              }],
            }
          }

          // Simulates a model that returns arrays containing dangerous content for CV optimization.
          if (process.env.GROQ_MOCK_RESPONSE === 'dangerous-array-content') {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    summary: ['<script>alert(1)</script>', 'javascript:void(0)'],
                    experience: ['Valid experience suggestion.'],
                    projects: ['Valid project suggestion.'],
                    skills: ['Valid skill suggestion.'],
                    education: ['Valid education suggestion.'],
                    certificates: ['Valid certificate suggestion.'],
                    consistency: ['Valid consistency suggestion.'],
                    keywords: ['react', 'node'],
                    generalImprovements: ['Valid improvement.'],
                    userId: 'injected',
                    passwordHash: 'fake',
                  }),
                },
              }],
            }
          }

          const userMessage = messages.find((message) => message.role === 'user')?.content || ''
          lastMockUserPrompt = String(userMessage)
          const lower = String(userMessage).toLowerCase()

          if (lower.includes('existingskills')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    existingSkills: ['React', 'Node.js'],
                    suggestedSkills: ['TypeScript', 'UX Research'],
                  }),
                },
              }],
            }
          }

          if (lower.includes('generalimprovements')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    summary: ['Tighten the opening statement around outcomes and stakeholder impact.'],
                    experience: ['Emphasize business outcomes and measurable improvements in your role summaries.'],
                    projects: ['Describe the technical challenge and your contribution in more specific terms.'],
                    skills: ['Group tools by stack for easier scanning.'],
                    education: ['Keep the existing education entry concise and consistent with the rest of the CV.'],
                    certificates: ['Keep certifications concise and linked to their supporting records when available.'],
                    consistency: ['Align the tone and phrasing across every section.'],
                    keywords: ['React', 'product thinking', 'cross-functional collaboration'],
                    generalImprovements: ['Use concise action-oriented phrasing and remove filler language.'],
                  }),
                },
              }],
            }
          }

          // Job description analysis — detected by the <job_title> delimiter (unique to job analysis).
          if (lower.includes('<job_title>')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    matchingSkills: ['React'],
                    missingOrNotEvidenced: ['TypeScript'],
                    keywords: ['accessibility', 'product thinking'],
                    relevantExperience: ['Frontend development experience is relevant to the role.'],
                    relevantProjects: ['The portfolio app demonstrates relevant product work.'],
                    suggestions: ['Add evidence of accessibility work if supported by the CV.'],
                  }),
                },
              }],
            }
          }

          // Project improvement — detected by <draft_text> + project-specific instruction text.
          // Must be checked before experience and summary branches.
          if (lower.includes('<draft_text>') && lower.includes('rewrite this owned project')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Built a portfolio app for managing content.',
                    suggestion: 'Created a portfolio application that simplified content management and presented information in a clear, accessible experience. The work demonstrates strong product thinking, technical execution, and a focus on usability.',
                    reason: 'Frames the project around value and execution without inventing outcomes.',
                  }),
                },
              }],
            }
          }

          // Experience improvement — detected by <draft_text> + experience-specific instruction text.
          if (lower.includes('<draft_text>') && lower.includes('improve this owned experience')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Built a website using React and CSS.',
                    suggestion: 'Developed and shipped a responsive website using React and CSS, with a focus on usability and clear user experience.',
                    reason: 'Improves professionalism and clarity while preserving the original scope and facts.',
                  }),
                },
              }],
            }
          }

          // Summary improvement — detected by <current_summary> delimiter.
          if (lower.includes('<current_summary>') || lower.includes('summary')) {
            return {
              choices: [{
                message: {
                  content: JSON.stringify({
                    original: 'Computer science graduate with strong product and technical skills.',
                    suggestion: 'Product-minded computer science graduate with a strong foundation in technical execution and clear problem solving.',
                    reason: 'Strengthens clarity and positioning without changing the underlying experience.',
                  }),
                },
              }],
            }
          }

          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  suggestion: 'This draft was refined to improve clarity and professionalism while preserving the factual content.',
                  reason: 'The wording is clearer and easier to read without inventing experience.',
                }),
              },
            }],
          }
        },
      },
    },
  }
}

export function getGroqClient() {
  if (process.env.AI_PROVIDER_MODE === 'disabled') {
    return null
  }

  if (!process.env.GROQ_API_KEY) {
    return null
  }

  if (process.env.GROQ_API_KEY === 'test-key' || process.env.GROQ_MOCK_MODE === 'true') {
    return createMockGroqClient()
  }

  return new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 20000,
  })
}

import PDFDocument from 'pdfkit'
import { prisma } from '../config/prisma.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

function sanitizeFilename(value) {
  const base = String(value || 'cv').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return base || 'cv'
}

function formatDate(dateValue) {
  if (!dateValue) return 'Present'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'Present'
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date)
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function buildCvData(user, profile, experience, education, skills, projects, certificates) {
  const name = user?.name || 'Professional'
  const summary = profile?.bio || profile?.headline || ''
  const contact = {
    email: user?.email || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    linkedin: profile?.linkedinUrl || '',
    github: profile?.githubUrl || '',
    website: profile?.websiteUrl || '',
  }

  return {
    name,
    title: profile?.headline || 'Professional',
    profileImage: profile?.profileImage || '',
    summary,
    contact,
    experience: ensureArray(experience).filter(Boolean),
    education: ensureArray(education).filter(Boolean),
    skills: ensureArray(skills).filter(Boolean),
    projects: ensureArray(projects).filter(Boolean),
    certificates: ensureArray(certificates).filter(Boolean),
  }
}

async function getProfileImageBuffer(imagePath) {
  if (!imagePath?.startsWith('/uploads/profile-images/')) return null
  try {
    const buffer = await readFile(path.resolve(process.cwd(), `.${imagePath}`))
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    return isJpeg || isPng || isWebp ? buffer : null
  } catch (error) {
    return null
  }
}

function addTextWithWrap(document, text, options = {}) {
  const { x, y, width, size = 11, bold = false, color = '#111111', align = 'left', lineGap = 2 } = options
  if (!text) return y

  document
    .fontSize(size)
    .font(bold ? 'Helvetica-Bold' : 'Helvetica')
    .fillColor(color)
    .text(text, x, y, { width, align, lineGap })

  return document.y
}

function addSectionHeader(document, label, x, y, width) {
  document
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#111111')
    .text(label, x, y, { width, align: 'left' })

  return document.y + 8
}

function addContactLine(document, label, value, x, y) {
  if (!value) return y
  document.fontSize(9).font('Helvetica').fillColor('#333333').text(`${label}: ${value}`, x, y, { width: 220, align: 'left' })
  return document.y + 12
}

function addExperienceSection(document, experience) {
  if (!experience.length) return

  let y = document.y + 12
  y = addSectionHeader(document, 'Experience', 50, y, 500)

  for (const item of experience) {
    const titleText = `${item.position || 'Professional'} — ${item.company || 'Organization'}`
    const meta = `${formatDate(item.startDate)} - ${item.endDate ? formatDate(item.endDate) : 'Present'}`
    y = addTextWithWrap(document, titleText, { x: 50, y, width: 500, size: 12, bold: true }) + 2
    y = addTextWithWrap(document, meta, { x: 50, y, width: 500, size: 9, color: '#444444' }) + 2
    if (item.description) {
      y = addTextWithWrap(document, item.description, { x: 70, y, width: 470, size: 10, lineGap: 2 }) + 6
    }
    if (document.y > 720) {
      document.addPage()
      y = 50
    }
  }
}

function addEducationSection(document, education) {
  if (!education.length) return

  let y = document.y + 12
  y = addSectionHeader(document, 'Education', 50, y, 500)

  for (const item of education) {
    const institution = item.institution || 'Institution'
    const qualification = [item.degree, item.field].filter(Boolean).join(' • ')
    y = addTextWithWrap(document, institution, { x: 50, y, width: 500, size: 11, bold: true }) + 2
    if (qualification) y = addTextWithWrap(document, qualification, { x: 50, y, width: 500, size: 10 }) + 2
    const period = `${formatDate(item.startDate)} - ${item.endDate ? formatDate(item.endDate) : 'Present'}`
    y = addTextWithWrap(document, period, { x: 50, y, width: 500, size: 9, color: '#444444' }) + 4
    if (item.description) {
      y = addTextWithWrap(document, item.description, { x: 70, y, width: 470, size: 10, lineGap: 2 }) + 6
    }
    if (document.y > 720) {
      document.addPage()
      y = 50
    }
  }
}

function addProjectSection(document, projects) {
  if (!projects.length) return

  let y = document.y + 12
  y = addSectionHeader(document, 'Projects', 50, y, 500)

  for (const project of projects) {
    y = addTextWithWrap(document, project.title || 'Project', { x: 50, y, width: 500, size: 11, bold: true }) + 2
    if (project.description) {
      y = addTextWithWrap(document, project.description, { x: 70, y, width: 470, size: 10, lineGap: 2 }) + 4
    }
    const links = [project.liveUrl, project.githubUrl].filter(Boolean)
    if (links.length) {
      y = addTextWithWrap(document, links.join(' • '), { x: 70, y, width: 470, size: 9, color: '#1d4ed8' }) + 4
    }
    if (project.technologies?.length) {
      y = addTextWithWrap(document, project.technologies.join(', '), { x: 70, y, width: 470, size: 9, color: '#444444' }) + 8
    }
    if (document.y > 720) {
      document.addPage()
      y = 50
    }
  }
}

function addSkillsSection(document, skills) {
  if (!skills.length) return

  let y = document.y + 12
  y = addSectionHeader(document, 'Skills', 50, y, 500)

  const skillNames = skills.map((skill) => (typeof skill === 'string' ? skill : (skill.name || ''))).filter(Boolean)
  y = addTextWithWrap(document, skillNames.join(' • '), { x: 50, y, width: 500, size: 10, lineGap: 2 }) + 12
}

function addCertificateSection(document, certificates) {
  if (!certificates.length) return

  let y = document.y + 12
  y = addSectionHeader(document, 'Certifications', 50, y, 500)

  for (const cert of certificates) {
    y = addTextWithWrap(document, `${cert.name || 'Certification'} — ${cert.issuer || ''}`.trim(), { x: 50, y, width: 500, size: 11, bold: true }) + 2
    if (cert.issueDate) {
      y = addTextWithWrap(document, formatDate(cert.issueDate), { x: 50, y, width: 500, size: 9, color: '#444444' }) + 4
    }
    if (document.y > 720) {
      document.addPage()
      y = 50
    }
  }
}

export async function getCvPdfBufferForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    const error = new Error('CV not found')
    error.statusCode = 404
    throw error
  }

  const [profile, experience, education, skills, projects, certificates] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.experience.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.education.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.skill.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.certificate.findMany({ where: { userId }, orderBy: { issueDate: 'desc' } }),
  ])

  const cvData = buildCvData(user, profile, experience, education, skills, projects, certificates)
  const profileImage = await getProfileImageBuffer(cvData.profileImage)
  const document = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks = []

  document.on('data', (chunk) => chunks.push(chunk))
  document.on('end', () => undefined)

  let headerImage = null
  if (profileImage) {
    try {
      document.image(profileImage, 50, 50, { fit: [72, 72] })
      headerImage = profileImage
    } catch (_error) {
      headerImage = null
    }
  }
  const headerX = headerImage ? 140 : 50
  document.font('Helvetica-Bold').fontSize(26).text(cvData.name, headerX, 50)
  document.font('Helvetica').fontSize(12).fillColor('#333333').text(cvData.title, headerX, 88)

  let y = 128
  const contactItems = [
    ['Email', cvData.contact.email],
    ['Phone', cvData.contact.phone],
    ['Location', cvData.contact.location],
    ['LinkedIn', cvData.contact.linkedin],
    ['GitHub', cvData.contact.github],
    ['Website', cvData.contact.website],
  ]

  for (const [label, value] of contactItems) {
    if (!value) continue
    y = addContactLine(document, label, value, headerImage ? 140 : 50, y)
  }

  if (cvData.summary) {
    let summaryY = document.y + 10
    summaryY = addSectionHeader(document, 'Summary', 50, summaryY, 500)
    summaryY = addTextWithWrap(document, cvData.summary, { x: 50, y: summaryY, width: 500, size: 10, lineGap: 2 }) + 12
    y = summaryY
  }

  if (cvData.experience.length) {
    addExperienceSection(document, cvData.experience)
  }
  if (cvData.education.length) {
    addEducationSection(document, cvData.education)
  }
  if (cvData.projects.length) {
    addProjectSection(document, cvData.projects)
  }
  if (cvData.skills.length) {
    addSkillsSection(document, cvData.skills)
  }
  if (cvData.certificates.length) {
    addCertificateSection(document, cvData.certificates)
  }

  document.end()

  await new Promise((resolve, reject) => {
    document.on('end', resolve)
    document.on('error', reject)
  })

  return Buffer.concat(chunks)
}

export function generateCvPdfFilename(user, fallback = 'cv') {
  const baseName = user?.name ? user.name.trim() : fallback
  const safeName = sanitizeFilename(baseName)
  return `${safeName || 'cv'}-cv.pdf`
}

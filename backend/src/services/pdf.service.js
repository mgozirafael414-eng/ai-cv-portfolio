import PDFDocument from 'pdfkit'
import { prisma } from '../config/prisma.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const margin = { top: 46, right: 46, bottom: 46, left: 48 }
const modernSidebarWidth = 172
const templates = new Set(['professional', 'modern', 'classic', 'minimal', 'creative'])
const colors = {
  navy: '#17324d',
  teal: '#176b67',
  royal: '#2855a6',
  burgundy: '#7a2e3a',
  forest: '#2f5d46',
  monochrome: '#222222',
}
const sectionNames = ['summary', 'experience', 'education', 'skills', 'projects', 'certificates', 'contact']

function sanitizeFilename(value) {
  const base = String(value || 'cv').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return base || 'cv'
}

function formatDate(dateValue) {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date)
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeOptions(options = {}) {
  const template = templates.has(options.template) ? options.template : 'professional'
  const colorPreset = Object.hasOwn(colors, options.colorPreset) ? options.colorPreset : 'navy'
  const requestedSections = Array.isArray(options.sections)
    ? options.sections
    : typeof options.sections === 'string'
      ? options.sections.split(',')
      : sectionNames
  const sections = Object.fromEntries(sectionNames.map((name) => [name, requestedSections.includes(name)]))
  const title = typeof options.title === 'string' ? options.title.trim().slice(0, 120) : ''
  return { template, color: colors[colorPreset], sections, title: title || 'Professional CV' }
}

function buildCvData(user, profile, experience, education, skills, projects, certificates) {
  return {
    name: user?.name || 'Professional',
    title: profile?.headline || '',
    profileImage: profile?.profileImage || '',
    summary: profile?.bio || '',
    contact: {
      email: user?.email || '',
      phone: profile?.phone || '',
      location: profile?.location || '',
      linkedin: profile?.linkedinUrl || '',
      github: profile?.githubUrl || '',
      website: profile?.websiteUrl || '',
    },
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
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function ensureRoom(document, height) {
  if (document.y + height > document.page.height - document.page.margins.bottom) document.addPage()
}

function writeText(document, text, { size = 10, font = 'Helvetica', color = '#222222', width, indent = 0, lineGap = 2 } = {}) {
  if (!text) return
  document.font(font).fontSize(size).fillColor(color).text(String(text), { width, indent, lineGap })
}

function writeSectionTitle(document, title, color, modern) {
  ensureRoom(document, 90)
  document.moveDown(0.55)
  document.font('Helvetica-Bold').fontSize(11).fillColor(color).text(title.toUpperCase(), { width: document.page.width - document.page.margins.left - document.page.margins.right, characterSpacing: 0.8, lineGap: 2 })
  const lineY = document.y + 4
  document.save()
  document.strokeColor(modern ? '#d5ddd9' : color).lineWidth(modern ? 0.5 : 0.8).moveTo(document.page.margins.left, lineY).lineTo(document.page.width - document.page.margins.right, lineY).stroke()
  document.restore()
  document.y = lineY + 10
}

function writeEntry(document, { title, subtitle, date, description, details, color }) {
  ensureRoom(document, 52)
  document.moveDown(0.3)
  writeText(document, title, { size: 10.5, font: 'Helvetica-Bold', color, width: document.page.width - document.page.margins.left - document.page.margins.right })
  if (subtitle) writeText(document, subtitle, { size: 9.5, color: '#43515a', width: document.page.width - document.page.margins.left - document.page.margins.right })
  if (date) writeText(document, date, { size: 8.5, color: '#65727a', width: document.page.width - document.page.margins.left - document.page.margins.right })
  if (description) {
    document.moveDown(0.18)
    writeText(document, description, { size: 9.5, color: '#263238', width: document.page.width - document.page.margins.left - document.page.margins.right, lineGap: 3 })
  }
  if (details) {
    document.moveDown(0.15)
    writeText(document, details, { size: 8.5, color: '#43515a', width: document.page.width - document.page.margins.left - document.page.margins.right, lineGap: 2 })
  }
  document.moveDown(0.38)
}

function writeSection(document, key, data, color, modern) {
  if (key === 'summary' && data.summary) {
    writeSectionTitle(document, 'Summary', color, modern)
    writeText(document, data.summary, { size: 10, color: '#263238', width: document.page.width - document.page.margins.left - document.page.margins.right, lineGap: 3 })
    return
  }

  if (key === 'experience' && data.experience.length) {
    writeSectionTitle(document, 'Experience', color, modern)
    for (const item of data.experience) {
      writeEntry(document, {
        title: item.position || 'Experience',
        subtitle: item.company,
        date: dateRange(item.startDate, item.endDate),
        description: item.description,
        color,
      })
    }
  }

  if (key === 'education' && data.education.length) {
    writeSectionTitle(document, 'Education', color, modern)
    for (const item of data.education) {
      writeEntry(document, {
        title: item.degree || item.institution || 'Education',
        subtitle: [item.institution, item.field].filter(Boolean).join(' · '),
        date: dateRange(item.startDate, item.endDate),
        description: item.description,
        color,
      })
    }
  }

  if (key === 'skills' && data.skills.length) {
    writeSectionTitle(document, 'Skills', color, modern)
    const names = data.skills.map((skill) => typeof skill === 'string' ? skill : skill.name).filter(Boolean)
    writeText(document, names.join('  ·  '), { size: 9.5, color: '#263238', width: document.page.width - document.page.margins.left - document.page.margins.right, lineGap: 4 })
  }

  if (key === 'projects' && data.projects.length) {
    writeSectionTitle(document, 'Projects', color, modern)
    for (const item of data.projects) {
      writeEntry(document, {
        title: item.title || 'Project',
        subtitle: ensureArray(item.technologies).join(' · '),
        description: item.description,
        details: [item.githubUrl, item.liveUrl].filter(Boolean).join(' · '),
        color,
      })
    }
  }

  if (key === 'certificates' && data.certificates.length) {
    writeSectionTitle(document, 'Certificates', color, modern)
    for (const item of data.certificates) {
      writeEntry(document, {
        title: item.name || 'Certificate',
        subtitle: item.issuer,
        date: formatDate(item.issueDate),
        details: item.credentialUrl,
        color,
      })
    }
  }
}

function dateRange(start, end) {
  const from = formatDate(start)
  const to = end ? formatDate(end) : (from ? 'Present' : '')
  return from ? `${from} — ${to}` : to
}

function drawModernSidebar(document, data, options, imageBuffer, firstPage = false) {
  const savedX = document.x
  const savedY = document.y
  document.save()
  document.fillColor('#173a3b').rect(0, 0, modernSidebarWidth, document.page.height).fill()
  document.restore()
  if (firstPage) {
    let y = 30
    if (imageBuffer) {
      try {
        document.image(imageBuffer, 26, y, { fit: [64, 64] })
        y += 78
      } catch {
        y += 8
      }
    }
    document.font('Helvetica-Bold').fontSize(7).fillColor('#9fc4b0').text(options.title.toUpperCase(), 22, y, { width: modernSidebarWidth - 44, lineGap: 2 })
    y = document.y + 7
    document.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text(data.name, 22, y, { width: modernSidebarWidth - 44, lineGap: 2 })
    y = document.y + 8
    if (data.title) {
      document.font('Helvetica').fontSize(9).fillColor('#d2dfd9').text(data.title, 22, y, { width: modernSidebarWidth - 44, lineGap: 2 })
      y = document.y + 14
    }
    if (options.sections.contact) {
      const contactValues = Object.values(data.contact).filter(Boolean)
      if (contactValues.length) {
        document.font('Helvetica-Bold').fontSize(8).fillColor('#9fc4b0').text('CONTACT', 22, y, { characterSpacing: 0.7 })
        y = document.y + 7
        for (const value of contactValues) {
          const height = document.heightOfString(value, { width: modernSidebarWidth - 44, font: 'Helvetica', fontSize: 8, lineGap: 2 })
          if (y + height > document.page.height - 30) break
          document.font('Helvetica').fontSize(8).fillColor('#eef2e9').text(value, 22, y, { width: modernSidebarWidth - 44, lineGap: 2 })
          y = document.y + 6
        }
      }
    }
    if (options.sections.skills && data.skills.length) {
      y += 10
      document.font('Helvetica-Bold').fontSize(8).fillColor('#9fc4b0').text('SKILLS', 22, y, { characterSpacing: 0.7 })
      y = document.y + 7
      for (const skill of data.skills) {
        const name = typeof skill === 'string' ? skill : skill.name
        if (!name) continue
        const height = document.heightOfString(name, { width: modernSidebarWidth - 44, font: 'Helvetica', fontSize: 8, lineGap: 2 })
        if (y + height > document.page.height - 30) break
        document.font('Helvetica').fontSize(8).fillColor('#eef2e9').text(name, 22, y, { width: modernSidebarWidth - 44, lineGap: 2 })
        y = document.y + 5
      }
    }
  }
  document.x = savedX
  document.y = savedY
}

function drawHeader(document, data, options, imageBuffer) {
  if (options.template === 'modern') return
  const left = document.page.margins.left
  const width = document.page.width - left - document.page.margins.right
  const top = document.y
  if (imageBuffer) {
    try {
      document.image(imageBuffer, left, top, { fit: [62, 62] })
    } catch {
      // Unsupported image data is omitted; text remains available.
    }
  }
  const textX = left + (imageBuffer ? 78 : 0)
  const textWidth = width - (imageBuffer ? 78 : 0)
  document.font('Helvetica-Bold').fontSize(8).fillColor(options.color).text(options.title.toUpperCase(), textX, top, { width: textWidth, characterSpacing: 0.6 })
  const nameY = document.y + 6
  document.font('Helvetica-Bold').fontSize(options.template === 'creative' ? 26 : 24).fillColor(options.color).text(data.name, textX, nameY, { width: textWidth, lineGap: 2 })
  if (data.title) document.font('Helvetica').fontSize(11).fillColor('#53616b').text(data.title, textX, document.y + 3, { width: textWidth })
  if (options.sections.contact) {
    const contact = Object.values(data.contact).filter(Boolean).join('  ·  ')
    if (contact) document.font('Helvetica').fontSize(8).fillColor('#39464e').text(contact, left, document.y + 8, { width, lineGap: 2, link: undefined })
  }
  const lineY = document.y + 12
  if (options.template !== 'minimal') {
    document.save()
    document.strokeColor(options.color).lineWidth(options.template === 'creative' ? 3 : 1.5).moveTo(left, lineY).lineTo(left + width, lineY).stroke()
    document.restore()
  }
  document.y = lineY + (options.template === 'creative' ? 15 : 12)
}

export async function getCvPdfBufferForUser(userId, settings = {}) {
  const options = normalizeOptions(settings)
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
  const data = buildCvData(user, profile, experience, education, skills, projects, certificates)
  const imageBuffer = await getProfileImageBuffer(data.profileImage)
  const modern = options.template === 'modern'
  const document = new PDFDocument({
    size: 'A4',
    margins: {
      top: margin.top,
      right: margin.right,
      bottom: margin.bottom,
      left: modern ? modernSidebarWidth + 24 : margin.left,
    },
    info: { Title: options.title, Author: data.name, Subject: 'Curriculum vitae' },
  })
  const chunks = []
  document.on('data', (chunk) => chunks.push(chunk))
  document.on('pageAdded', () => {
    if (modern) drawModernSidebar(document, data, options, imageBuffer)
    if (options.template === 'creative') {
      document.save()
      document.fillColor(options.color).rect(0, 0, document.page.width, 8).fill()
      document.restore()
    }
  })
  if (modern) drawModernSidebar(document, data, options, imageBuffer, true)
  if (options.template === 'creative') {
    document.save()
    document.fillColor(options.color).rect(0, 0, document.page.width, 8).fill()
    document.restore()
  }
  drawHeader(document, data, options, imageBuffer)
  for (const key of ['summary', 'experience', 'education', 'skills', 'projects', 'certificates']) {
    if (options.sections[key]) writeSection(document, key, data, options.color, modern)
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

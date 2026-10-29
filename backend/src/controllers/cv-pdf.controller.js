import { generateCvPdfFilename, getCvPdfBufferForUser } from '../services/pdf.service.js'
import { prisma } from '../config/prisma.js'

export async function downloadCurrentCvPdf(request, response, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) {
      return response.status(404).json({ error: 'CV not found' })
    }

    const profile = await prisma.profile.findUnique({ where: { userId: request.userId } })
    if (!profile) {
      return response.status(404).json({ error: 'CV not found' })
    }

    const pdfBuffer = await getCvPdfBufferForUser(request.userId, {
      template: request.query.template,
      colorPreset: request.query.colorPreset,
      title: request.query.title,
      sections: request.query.sections,
    })
    const filename = generateCvPdfFilename(user, 'cv')

    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    response.setHeader('Content-Length', String(pdfBuffer.length))
    return response.send(pdfBuffer)
  } catch (error) {
    if (error?.statusCode === 404) {
      return response.status(404).json({ error: 'CV not found' })
    }
    return next(error)
  }
}

import { prisma } from '../config/prisma.js'
import { createOwnedResourceService } from './owned-resource.service.js'

export const skillService = createOwnedResourceService(prisma.skill, 'Skill')

const createSkill = skillService.create
skillService.create = async (userId, data) => {
	const duplicate = (await prisma.skill.findMany({ where: { userId } }))
		.find((skill) => skill.name.toLowerCase() === data.name.toLowerCase())
	if (duplicate) {
		const error = new Error('A skill with that name already exists')
		error.statusCode = 409
		throw error
	}

	return createSkill(userId, data)
}

const updateSkill = skillService.update
skillService.update = async (userId, id, data) => {
	if (data.name) {
		const duplicate = (await prisma.skill.findMany({ where: { userId } }))
			.find((skill) => skill.id !== id && skill.name.toLowerCase() === data.name.toLowerCase())
		if (duplicate) {
			const error = new Error('A skill with that name already exists')
			error.statusCode = 409
			throw error
		}
	}

	return updateSkill(userId, id, data)
}

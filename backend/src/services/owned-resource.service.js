function notFound(resourceName) {
  const error = new Error(`${resourceName} not found`)
  error.statusCode = 404
  return error
}

export function createOwnedResourceService(model, resourceName) {
  return {
    list(userId) {
      return model.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    },

    create(userId, data) {
      // Explicitly exclude any client-supplied userId from the data payload.
      // Ownership is always determined by the authenticated JWT user ID, not
      // by anything the client sends in the request body.
      const { userId: _ignored, ...safeData } = data
      return model.create({ data: { userId, ...safeData } })
    },

    async update(userId, id, data) {
      const ownedRecord = await model.findFirst({ where: { id, userId } })
      if (!ownedRecord) throw notFound(resourceName)
      return model.update({ where: { id }, data })
    },

    async remove(userId, id) {
      const ownedRecord = await model.findFirst({ where: { id, userId } })
      if (!ownedRecord) throw notFound(resourceName)
      return model.delete({ where: { id } })
    },
  }
}

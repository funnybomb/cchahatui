import { errorResponse, ApiError } from '../middleware/errorHandler.js'
import { projectService } from '../services/projectService.js'
import { clearRecentProjectsCache } from './sessions.js'

export async function handleProjectsApi(req: Request, url: URL, segments: string[]): Promise<Response> {
  try {
    if (segments.length !== 2) {
      throw ApiError.notFound(`Unknown projects route: ${url.pathname}`)
    }

    switch (req.method) {
      case 'GET':
        return Response.json({ projects: await projectService.listProjects() })
      case 'POST':
        return await addProject(req)
      case 'DELETE':
        return await removeProject(url)
      default:
        return Response.json(
          { error: 'METHOD_NOT_ALLOWED', message: `Method ${req.method} not allowed` },
          { status: 405 },
        )
    }
  } catch (error) {
    return errorResponse(error)
  }
}

async function addProject(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { path?: unknown }
  if (typeof body.path !== 'string') {
    throw ApiError.badRequest('path (string) is required')
  }
  const project = await projectService.addProject(body.path)
  clearRecentProjectsCache()
  return Response.json({ project })
}

async function removeProject(url: URL): Promise<Response> {
  const projectPath = url.searchParams.get('path')
  if (!projectPath) {
    throw ApiError.badRequest('path query parameter is required')
  }
  const removed = await projectService.removeProject(projectPath)
  if (removed) clearRecentProjectsCache()
  return Response.json({ ok: true, removed })
}

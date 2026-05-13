import { api } from './client'
import type { RecentProject } from './sessions'

export const projectsApi = {
  list() {
    return api.get<{ projects: RecentProject[] }>('/api/projects')
  },

  addProject(path: string) {
    return api.post<{ project: RecentProject }>('/api/projects', { path })
  },

  removeProject(path: string) {
    const query = new URLSearchParams({ path })
    return api.delete<{ ok: true; removed: boolean }>(`/api/projects?${query.toString()}`)
  },
}

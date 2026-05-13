import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROJECT_NAVIGATION_STORAGE_KEY,
  normalizeProjectNavigationPersistence,
  useProjectNavigationStore,
} from './projectNavigationStore'

describe('projectNavigationStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useProjectNavigationStore.setState({ pinnedProjectPaths: [] })
  })

  it('normalizes legacy pinned project arrays', () => {
    expect(normalizeProjectNavigationPersistence({
      pinnedProjects: ['/repo/app', '', '/repo/app', 123],
    })).toEqual({
      version: 1,
      pinnedProjectPaths: ['/repo/app'],
    })
  })

  it('pins, unpins, and persists project paths without duplicates', () => {
    useProjectNavigationStore.getState().pinProject('/repo/app')
    useProjectNavigationStore.getState().pinProject('/repo/app')

    expect(useProjectNavigationStore.getState().pinnedProjectPaths).toEqual(['/repo/app'])
    expect(JSON.parse(window.localStorage.getItem(PROJECT_NAVIGATION_STORAGE_KEY) || '{}')).toMatchObject({
      version: 1,
      pinnedProjectPaths: ['/repo/app'],
    })

    useProjectNavigationStore.getState().unpinProject('/repo/app')

    expect(useProjectNavigationStore.getState().isPinned('/repo/app')).toBe(false)
  })

  it('ignores blank project paths', () => {
    useProjectNavigationStore.getState().pinProject(' ')

    expect(useProjectNavigationStore.getState().pinnedProjectPaths).toEqual([])
  })
})

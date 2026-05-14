import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

const { getRecentProjectsMock, addProjectMock, removeProjectMock, addToastMock, dialogOpenMock } = vi.hoisted(() => ({
  getRecentProjectsMock: vi.fn(),
  addProjectMock: vi.fn(),
  removeProjectMock: vi.fn(),
  addToastMock: vi.fn(),
  dialogOpenMock: vi.fn(),
}))

vi.mock('../../api/sessions', async () => {
  const actual = await vi.importActual<typeof import('../../api/sessions')>('../../api/sessions')
  return {
    ...actual,
    sessionsApi: {
      ...actual.sessionsApi,
      getRecentProjects: getRecentProjectsMock,
    },
  }
})

vi.mock('../../api/projects', () => ({
  projectsApi: {
    addProject: addProjectMock,
    removeProject: removeProjectMock,
  },
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: dialogOpenMock,
}))

vi.mock('../../stores/uiStore', async () => {
  const actual = await vi.importActual<typeof import('../../stores/uiStore')>('../../stores/uiStore')
  return {
    ...actual,
    useUIStore: Object.assign(actual.useUIStore, {
      getState: actual.useUIStore.getState,
      setState: actual.useUIStore.setState,
    }),
  }
})

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'sidebar.allProjects': 'All projects',
      'sidebar.other': 'Other',
      'sidebar.noSessions': 'No sessions',
      'sidebar.addProject': 'Add project',
      'sidebar.projectAdded': 'Project added.',
      'sidebar.projectRemoved': 'Project removed.',
      'sidebar.projectAddFailed': 'Failed to add project.',
      'sidebar.projectRemoveFailed': 'Failed to remove project.',
      'sidebar.projectPathPlaceholder': 'Paste path',
      'sidebar.removeProject': 'Remove project',
      'common.add': 'Add',
      'common.cancel': 'Cancel',
      'common.loading': 'Loading',
    }

    return translations[key] ?? key
  },
}))

import { useSessionStore } from '../../stores/sessionStore'
import { useUIStore } from '../../stores/uiStore'
import { ProjectFilter, resetProjectFilterCacheForTests } from './ProjectFilter'

describe('ProjectFilter', () => {
  beforeEach(() => {
    getRecentProjectsMock.mockReset()
    resetProjectFilterCacheForTests()
    addProjectMock.mockReset()
    removeProjectMock.mockReset()
    addToastMock.mockReset()
    dialogOpenMock.mockReset()
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    useUIStore.setState({ addToast: addToastMock } as Partial<ReturnType<typeof useUIStore.getState>>)
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,
      selectedProjects: [],
      availableProjects: [
        'Users-nanmi-workspace-myself_code-OpenCutSkill',
        'Users-nanmi-workspace-myself_code-claude-code-haha',
      ],
    })
  })

  it('renders recent project metadata instead of bare fallback folder names', async () => {
    getRecentProjectsMock.mockResolvedValue({
      projects: [
        {
          projectPath: 'Users-nanmi-workspace-myself_code-claude-code-haha',
          realPath: '/Users/nanmi/workspace/myself_code/claude-code-haha',
          projectName: 'claude-code-haha',
          isGit: true,
          repoName: 'NanmiCoder/cc-haha',
          branch: 'main',
          modifiedAt: '2026-04-20T10:00:00.000Z',
          sessionCount: 4,
        },
        {
          projectPath: 'Users-nanmi-workspace-myself_code-OpenCutSkill',
          realPath: '/Users/nanmi/workspace/myself_code/OpenCutSkill',
          projectName: 'OpenCutSkill',
          isGit: true,
          repoName: 'NanmiCoder/OpenCutSkill',
          branch: 'main',
          modifiedAt: '2026-04-20T09:00:00.000Z',
          sessionCount: 2,
        },
      ],
    })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /All projects/i }))

    await waitFor(() => {
      expect(screen.getByText('NanmiCoder/cc-haha')).toBeInTheDocument()
      expect(screen.getByText('~/workspace/myself_code/claude-code-haha')).toBeInTheDocument()
      expect(screen.queryByText('/Users/nanmi/workspace/myself_code/claude-code-haha')).not.toBeInTheDocument()
      expect(screen.getByText('NanmiCoder/OpenCutSkill')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /NanmiCoder\/cc-haha/i }))

    await waitFor(() => {
      expect(useSessionStore.getState().selectedProjects).toEqual(['Users-nanmi-workspace-myself_code-claude-code-haha'])
    })

    expect(screen.getAllByRole('button', { name: /NanmiCoder\/cc-haha/i })).toHaveLength(2)
  })

  it('uses safe fallback names for path-sanitized project options without metadata', async () => {
    const projectPath = '-Users-funnybomb-private-work-haha+tui'
    useSessionStore.setState({
      selectedProjects: [],
      availableProjects: [projectPath],
    })
    getRecentProjectsMock.mockResolvedValue({ projects: [] })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /All projects/i }))

    await waitFor(() => {
      expect(screen.getByText('haha+tui')).toBeInTheDocument()
    })
    expect(screen.queryByText(projectPath)).not.toBeInTheDocument()
  })

  it('adds a project by typed path in web browsers', async () => {
    getRecentProjectsMock
      .mockResolvedValueOnce({ projects: [] })
      .mockResolvedValueOnce({
        projects: [{
          projectPath: '/workspace/new-project',
          realPath: '/workspace/new-project',
          projectName: 'new-project',
          isGit: false,
          repoName: null,
          branch: null,
          modifiedAt: '2026-05-01T00:00:00.000Z',
          sessionCount: 0,
          saved: true,
        }],
      })
    addProjectMock.mockResolvedValue({
      project: {
        projectPath: '/workspace/new-project',
        realPath: '/workspace/new-project',
      },
    })
    const fetchSessions = vi.fn().mockResolvedValue(undefined)
    useSessionStore.setState({ availableProjects: [], fetchSessions })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /All projects/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add project/ })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Add project/ }))
    fireEvent.change(screen.getByPlaceholderText('Paste path'), {
      target: { value: '/workspace/new-project' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(addProjectMock).toHaveBeenCalledWith('/workspace/new-project')
      expect(fetchSessions).toHaveBeenCalled()
      expect(useSessionStore.getState().selectedProjects).toEqual(['/workspace/new-project'])
    })
  })

  it('opens the desktop project picker at the selected project path', async () => {
    ;(window as unknown as { __TAURI__?: unknown }).__TAURI__ = {}
    getRecentProjectsMock
      .mockResolvedValueOnce({
        projects: [{
          projectPath: '/workspace/current',
          realPath: '/workspace/current',
          projectName: 'current',
          isGit: false,
          repoName: null,
          branch: null,
          modifiedAt: '2026-05-01T00:00:00.000Z',
          sessionCount: 1,
          saved: true,
        }],
      })
      .mockResolvedValueOnce({
        projects: [{
          projectPath: '/workspace/next',
          realPath: '/workspace/next',
          projectName: 'next',
          isGit: false,
          repoName: null,
          branch: null,
          modifiedAt: '2026-05-02T00:00:00.000Z',
          sessionCount: 0,
          saved: true,
        }],
      })
    addProjectMock.mockResolvedValue({
      project: {
        projectPath: '/workspace/next',
        realPath: '/workspace/next',
      },
    })
    dialogOpenMock.mockResolvedValue('/workspace/next')
    const fetchSessions = vi.fn().mockResolvedValue(undefined)
    useSessionStore.setState({
      availableProjects: ['/workspace/current'],
      selectedProjects: ['/workspace/current'],
      fetchSessions,
    })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /current/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add project/ })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Add project/ }))

    await waitFor(() => {
      expect(dialogOpenMock).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        title: 'dirPicker.chooseProjectFolder',
        defaultPath: '/workspace/current',
      })
      expect(addProjectMock).toHaveBeenCalledWith('/workspace/next')
    })
  })

  it('opens the desktop project picker at the most recent project when all projects are selected', async () => {
    ;(window as unknown as { __TAURI__?: unknown }).__TAURI__ = {}
    getRecentProjectsMock.mockResolvedValue({
      projects: [{
        projectPath: '/workspace/recent',
        realPath: '/workspace/recent',
        projectName: 'recent',
        isGit: false,
        repoName: null,
        branch: null,
        modifiedAt: '2026-05-02T00:00:00.000Z',
        sessionCount: 1,
        saved: true,
      }],
    })
    dialogOpenMock.mockResolvedValue(null)
    useSessionStore.setState({
      availableProjects: ['/workspace/recent'],
      selectedProjects: [],
    })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /All projects/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add project/ })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Add project/ }))

    await waitFor(() => {
      expect(dialogOpenMock).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        title: 'dirPicker.chooseProjectFolder',
        defaultPath: '/workspace/recent',
      })
    })
    expect(addProjectMock).not.toHaveBeenCalled()
  })

  it('removes a saved project from the project filter', async () => {
    getRecentProjectsMock
      .mockResolvedValueOnce({
        projects: [{
          projectPath: '/workspace/saved',
          realPath: '/workspace/saved',
          projectName: 'saved',
          isGit: false,
          repoName: null,
          branch: null,
          modifiedAt: '2026-05-01T00:00:00.000Z',
          sessionCount: 0,
          saved: true,
        }],
      })
      .mockResolvedValueOnce({ projects: [] })
    removeProjectMock.mockResolvedValue({ ok: true, removed: true })
    const fetchSessions = vi.fn().mockResolvedValue(undefined)
    useSessionStore.setState({
      selectedProjects: ['/workspace/saved'],
      availableProjects: ['/workspace/saved'],
      fetchSessions,
    })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /saved/i }))
    await waitFor(() => {
      expect(screen.getByText('/workspace/saved')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove project' }))

    await waitFor(() => {
      expect(removeProjectMock).toHaveBeenCalledWith('/workspace/saved')
      expect(fetchSessions).toHaveBeenCalled()
      expect(useSessionStore.getState().selectedProjects).toEqual([])
    })
  })
})

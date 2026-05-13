import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

const { removeProjectMock } = vi.hoisted(() => ({
  removeProjectMock: vi.fn(),
}))

vi.mock('./ProjectFilter', () => ({
  ProjectFilter: () => <div data-testid="project-filter" />,
}))

vi.mock('../../api/projects', () => ({
  projectsApi: {
    removeProject: removeProjectMock,
  },
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'sidebar.newSession': 'New Session',
      'sidebar.scheduled': 'Scheduled',
      'sidebar.settings': 'Settings',
      'sidebar.searchPlaceholder': 'Search sessions',
      'sidebar.noSessions': 'No sessions',
      'sidebar.noMatching': 'No matching sessions',
      'sidebar.sessionListFailed': 'Session list failed',
      'common.retry': 'Retry',
      'common.loading': 'Loading...',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.delete': 'Delete',
      'common.rename': 'Rename',
      'common.close': 'Close',
      'sidebar.timeGroup.today': 'Today',
      'sidebar.timeGroup.yesterday': 'Yesterday',
      'sidebar.timeGroup.last7days': 'Last 7 Days',
      'sidebar.timeGroup.last30days': 'Last 30 Days',
      'sidebar.timeGroup.older': 'Older',
      'sidebar.missingDir': 'Missing',
      'sidebar.confirmDelete': 'Delete this session? This cannot be undone.',
      'sidebar.batchManage': 'Batch manage',
      'sidebar.batchSelectedCount': '{count} selected',
      'sidebar.batchSelectAll': 'Select all',
      'sidebar.batchDeselectAll': 'Deselect all',
      'sidebar.batchSelectGroup': 'Select {group}',
      'sidebar.batchDeleteSelected': 'Delete selected ({count})',
      'sidebar.batchDeleteConfirm': 'Delete {count} sessions? This cannot be undone.',
      'sidebar.batchDeleteConfirmBody': 'The following sessions will be deleted:',
      'sidebar.batchDeleteMore': '...and {count} more',
      'sidebar.batchExit': 'Cancel batch mode',
      'sidebar.batchDeleteSucceeded': 'Deleted {count} sessions.',
      'sidebar.batchDeleteFailed': '{count} sessions could not be deleted.',
      'sidebar.projectsTitle': 'Projects',
      'sidebar.projectPinned': 'Pinned',
      'sidebar.projectActive': 'Active',
      'sidebar.projectNoSessions': 'No sessions',
      'sidebar.projectSessionCount': '{count} sessions',
      'sidebar.projectMissingCount': '{count} missing',
      'sidebar.projectNewSession': 'New session in {project}',
      'sidebar.projectActions': 'Project actions for {project}',
      'sidebar.sessionActions': 'Session actions for {session}',
      'sidebar.projectCreateFirstSession': 'New session',
      'sidebar.projectPin': 'Pin project',
      'sidebar.projectUnpin': 'Unpin project',
      'sidebar.projectForget': 'Forget project',
      'sidebar.projectForgotten': 'Project removed from the list.',
      'sidebar.projectForgetFailed': 'Failed to forget project.',
      'sidebar.projectMemory': 'Project memory',
      'sidebar.projectMemoryBadge': 'Memory',
      'sidebar.projectMemoryHint': 'Saved notes are added as private context.',
      'sidebar.projectMemoryPlaceholder': 'Project facts...',
      'sidebar.projectMemorySummary': 'Project memory summary',
      'sidebar.projectMemoryFacts': 'Facts',
      'sidebar.projectMemoryFactsPlaceholder': 'One fact per line...',
      'sidebar.projectMemoryDecisions': 'Decisions',
      'sidebar.projectMemoryDecisionsPlaceholder': 'One decision per line...',
      'sidebar.projectMemoryOpenTasks': 'Open tasks',
      'sidebar.projectMemoryOpenTasksPlaceholder': 'One open task per line...',
      'sidebar.projectMemoryIncludeInContext': 'Reuse in new chats',
      'sidebar.projectMemoryIncludeInContextHint': 'Adds memory privately.',
      'sidebar.projectMemoryClear': 'Clear memory',
      'sidebar.projectMemoryUpdatedAt': 'Updated {time}',
      'sidebar.projectMemoryNeverUpdated': 'Never',
      'sidebar.projectMemoryCharacters': '{count} chars',
      'sidebar.projectMemorySaved': 'Project memory saved.',
      'sidebar.projectMemoryCleared': 'Project memory cleared.',
      'sidebar.projectMemoryNoProject': 'Open a project session before editing project memory.',
      'sidebar.openProjectMemory': 'Edit memory for {project}',
      'sidebar.copyProjectPath': 'Copy project path',
      'sidebar.projectPathCopied': 'Project path copied.',
      'sidebar.projectPathCopyFailed': 'Failed to copy project path.',
      'sidebar.sessionRunning': 'Session running',
      'sidebar.relative.now': 'now',
      'sidebar.relative.minutes': '{count}m',
      'sidebar.relative.hours': '{count}h',
      'sidebar.relative.days': '{count}d',
      'sidebar.relative.months': '{count}mo',
      'sidebar.collapse': 'Collapse sidebar',
      'sidebar.expand': 'Expand sidebar',
      'shortcuts.title': 'Keyboard shortcuts',
    }

    let text = translations[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    }
    return text
  },
}))

import { Sidebar } from './Sidebar'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useTabStore } from '../../stores/tabStore'
import { useUIStore } from '../../stores/uiStore'
import { useProjectMemoryStore } from '../../stores/projectMemoryStore'
import { useProjectNavigationStore } from '../../stores/projectNavigationStore'

function getSessionMainButton(name: RegExp) {
  const button = screen
    .getAllByRole('button', { name })
    .find((candidate) => !candidate.getAttribute('aria-label')?.startsWith('Session actions for '))
  if (!button) throw new Error(`Session button not found: ${String(name)}`)
  return button
}

describe('Sidebar', () => {
  const connectToSession = vi.fn()
  const disconnectSession = vi.fn()
  const fetchSessions = vi.fn()
  const createSession = vi.fn()
  const deleteSession = vi.fn()
  const deleteSessions = vi.fn()
  const renameSession = vi.fn()
  const addToast = vi.fn()
  const initialProjectMemoryState = useProjectMemoryStore.getInitialState()

  beforeEach(() => {
    window.localStorage.clear()
    connectToSession.mockReset()
    disconnectSession.mockReset()
    fetchSessions.mockReset()
    createSession.mockReset()
    deleteSession.mockReset()
    deleteSessions.mockReset()
    renameSession.mockReset()
    addToast.mockReset()
    removeProjectMock.mockReset()

    useTabStore.setState({ tabs: [], activeTabId: null })
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,
      selectedProjects: [],
      availableProjects: [],
      isBatchMode: false,
      selectedSessionIds: new Set(),
      fetchSessions,
      createSession,
      deleteSession,
      deleteSessions,
      renameSession,
    })
    useChatStore.setState({
      connectToSession,
      disconnectSession,
    } as Partial<ReturnType<typeof useChatStore.getState>>)
    useUIStore.setState({
      sidebarOpen: true,
      addToast,
    } as Partial<ReturnType<typeof useUIStore.getState>>)
    useProjectMemoryStore.setState({ ...initialProjectMemoryState, memories: {} }, true)
    useProjectNavigationStore.setState({ pinnedProjectPaths: [] })
  })

  afterEach(() => {
    cleanup()
    useTabStore.setState({ tabs: [], activeTabId: null })
  })

  it('opens a new tab when creating a session from the sidebar', async () => {
    createSession.mockResolvedValue('session-new-1')

    render(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Session' }))
    })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
      expect(connectToSession).toHaveBeenCalledWith('session-new-1')
    })

    expect(useTabStore.getState().tabs).toEqual([
      { sessionId: 'session-new-1', title: 'New Session', type: 'session', status: 'idle' },
    ])
    expect(useTabStore.getState().activeTabId).toBe('session-new-1')
    expect(screen.getByRole('complementary')).not.toHaveAttribute('data-tauri-drag-region')
  })

  it('shows a toast when session creation fails', async () => {
    createSession.mockRejectedValue(new Error('boom'))

    render(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Session' }))
    })

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'boom',
      })
    })

    expect(useTabStore.getState().tabs).toEqual([])
  })

  it('requires confirmation before deleting a session from the sidebar', async () => {
    deleteSession.mockResolvedValue(undefined)
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Open Session',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          messageCount: 1,
          projectPath: '/workspace/project',
          workDir: '/workspace/project',
          workDirExists: true,
        },
      ],
    })
    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Open Session', type: 'session', status: 'idle' }],
      activeTabId: 'session-1',
    })

    render(<Sidebar />)

    fireEvent.contextMenu(getSessionMainButton(/Open Session/))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteSession).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Delete this session? This cannot be undone.')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('session-1')
      expect(disconnectSession).toHaveBeenCalledWith('session-1')
    })

    expect(useTabStore.getState().tabs).toEqual([])
    expect(useTabStore.getState().activeTabId).toBeNull()
  })

  it('selects and deletes multiple sessions from batch mode', async () => {
    deleteSessions.mockResolvedValue({
      ok: true,
      successes: ['session-1', 'session-2'],
      failures: [],
    })
    const now = new Date().toISOString()
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'First Session',
          createdAt: now,
          modifiedAt: now,
          messageCount: 1,
          projectPath: '/workspace/project',
          workDir: '/workspace/project',
          workDirExists: true,
        },
        {
          id: 'session-2',
          title: 'Second Session',
          createdAt: now,
          modifiedAt: now,
          messageCount: 1,
          projectPath: '/workspace/project',
          workDir: '/workspace/project',
          workDirExists: true,
        },
      ],
    })
    useTabStore.setState({
      tabs: [
        { sessionId: 'session-1', title: 'First Session', type: 'session', status: 'idle' },
        { sessionId: 'session-2', title: 'Second Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'session-1',
    })

    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Batch manage' }))
    fireEvent.click(screen.getByRole('button', { name: /First Session/ }))
    fireEvent.click(screen.getByRole('button', { name: /Second Session/ }))

    expect(screen.getByText('2 selected')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete 2 sessions? This cannot be undone.')).toBeInTheDocument()
    expect(within(dialog).getByText('First Session')).toBeInTheDocument()
    expect(within(dialog).getByText('Second Session')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })

    await waitFor(() => {
      expect(deleteSessions).toHaveBeenCalledWith(['session-1', 'session-2'])
      expect(disconnectSession).toHaveBeenCalledWith('session-1')
      expect(disconnectSession).toHaveBeenCalledWith('session-2')
    })
    expect(useTabStore.getState().tabs).toEqual([])
    expect(addToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'Deleted 2 sessions.',
    })
  })

  it('collapses into an icon rail and expands back', async () => {
    render(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    })

    expect(useUIStore.getState().sidebarOpen).toBe(false)
    expect(screen.queryByPlaceholderText('Search sessions')).not.toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveAttribute('data-state', 'closed')
    expect(screen.getByTestId('sidebar-expand-button')).toHaveClass('sidebar-toggle-button--collapsed')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    })

    expect(useUIStore.getState().sidebarOpen).toBe(true)
    expect(screen.getByPlaceholderText('Search sessions')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveAttribute('data-state', 'open')
  })

  it('keeps the project filter section overflow visible for dropdown menus', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-project-filter-section')).toHaveStyle({ overflow: 'visible' })
    expect(screen.getByTestId('sidebar-project-filter-section')).toHaveClass('relative', 'z-20')
  })

  it('keeps the session list section in a constrained flex column for scrolling', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-session-list-section')).toHaveClass('flex', 'flex-1', 'min-h-0', 'flex-col')
  })

  it('groups sessions by project and starts a project-scoped session from the group action', async () => {
    createSession.mockResolvedValue('session-project-new')
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
        {
          id: 'session-2',
          title: 'Project B Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T01:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-b',
          workDir: '/workspace/project-b',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    expect(screen.getByText('project-a')).toBeInTheDocument()
    expect(screen.getByText('project-b')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New session in project-a' }))
    })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith('/workspace/project-a')
      expect(connectToSession).toHaveBeenCalledWith('session-project-new')
    })
  })

  it('shows pinned, active, empty, and missing project states', () => {
    useProjectNavigationStore.getState().pinProject('/workspace/pinned')
    useSessionStore.setState({
      availableProjects: ['/workspace/pinned', '/workspace/empty'],
      sessions: [
        {
          id: 'session-active',
          title: 'Active Project Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T04:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
        {
          id: 'session-missing',
          title: 'Missing Project Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T03:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-missing',
          workDir: '/workspace/project-missing',
          workDirExists: false,
        },
      ],
    })
    useTabStore.setState({
      tabs: [{ sessionId: 'session-active', title: 'Active Project Task', type: 'session', status: 'idle' }],
      activeTabId: 'session-active',
    })

    render(<Sidebar />)

    const groups = screen.getAllByTestId('sidebar-project-group')
    const pinnedGroup = groups[0]
    expect(pinnedGroup).toBeTruthy()
    expect(pinnedGroup!).toHaveAttribute('data-pinned', 'true')
    expect(within(pinnedGroup!).getByText('pinned')).toBeInTheDocument()
    expect(within(pinnedGroup!).getByText('Pinned')).toBeInTheDocument()

    const activeGroup = groups.find((group) => within(group).queryByText('project-a'))
    expect(activeGroup).toBeTruthy()
    expect(within(activeGroup!).getByText('Active')).toBeInTheDocument()

    const emptyGroup = groups.find((group) => within(group).queryByText('empty'))
    expect(emptyGroup).toHaveAttribute('data-project-state', 'empty')
    expect(within(emptyGroup!).getByText('No sessions')).toBeInTheDocument()

    const missingGroup = groups.find((group) => within(group).queryByText('project-missing'))
    expect(missingGroup).toHaveAttribute('data-project-state', 'missing')
    expect(within(missingGroup!).getByText(/1 missing/)).toBeInTheDocument()
  })

  it('filters project groups by both project path and work dir', () => {
    useSessionStore.setState({
      selectedProjects: ['/workspace/project-a'],
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
        {
          id: 'session-2',
          title: 'Project B Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T01:00:00.000Z',
          messageCount: 1,
          projectPath: '',
          workDir: '/workspace/project-b',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    expect(screen.getByText('Project A Task')).toBeInTheDocument()
    expect(screen.queryByText('Project B Task')).not.toBeInTheDocument()
  })

  it('opens project memory from the active project shortcut event', async () => {
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Open Session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })
    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Open Session', type: 'session', status: 'idle' }],
      activeTabId: 'session-1',
    })

    render(<Sidebar />)

    fireEvent(window, new CustomEvent('cchahatui:open-project-memory'))

    const dialog = await screen.findByRole('dialog', { name: 'Project memory' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('project-a')).toBeInTheDocument()
  })

  it('shows a toast when project memory is requested without an active project', () => {
    render(<Sidebar />)

    fireEvent(window, new CustomEvent('cchahatui:open-project-memory'))

    expect(useUIStore.getState().sidebarOpen).toBe(true)
    expect(addToast).toHaveBeenCalledWith({
      type: 'info',
      message: 'Open a project session before editing project memory.',
    })
  })

  it('opens project memory from a project group action and saves the note', async () => {
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit memory for project-a' }))
    fireEvent.change(screen.getByPlaceholderText('Project facts...'), {
      target: { value: 'Use desktop smoke tests.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Project memory saved.',
      })
    })
  })

  it('shows a quiet memory badge for projects with saved memory', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/project-a', 'Use the desktop smoke lane.')
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    const group = screen.getByTestId('sidebar-project-group')
    expect(group).toHaveAttribute('data-memory-state', 'saved')
    expect(within(group).getByText('Memory')).toBeInTheDocument()
  })

  it('opens a project context menu with project actions', async () => {
    createSession.mockResolvedValue('session-project-context')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    fireEvent.contextMenu(screen.getByText('project-a'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy project path' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('/workspace/project-a')
      expect(addToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Project path copied.',
      })
    })

    fireEvent.contextMenu(screen.getByText('project-a'))
    const projectContextNewSession = screen
      .getAllByRole('button', { name: 'New session in project-a' })
      .find((button) => button.textContent === 'New session in project-a')
    expect(projectContextNewSession).toBeTruthy()
    await act(async () => {
      fireEvent.click(projectContextNewSession!)
    })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith('/workspace/project-a')
      expect(connectToSession).toHaveBeenCalledWith('session-project-context')
    })

    fireEvent.contextMenu(screen.getByText('project-a'))
    fireEvent.click(screen.getByRole('button', { name: 'Project memory' }))
    expect(await screen.findByRole('dialog', { name: 'Project memory' })).toBeInTheDocument()
  })

  it('opens project actions from the app-rendered menu button without browser right-click', async () => {
    createSession.mockResolvedValue('session-project-context')
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Project actions for project-a' }))

    expect(screen.getByRole('button', { name: 'Pin project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy project path' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Forget project' })).toBeInTheDocument()
  })

  it('opens session actions from the app-rendered menu button without browser right-click', async () => {
    renameSession.mockResolvedValue(undefined)
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Open Session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Session actions for Open Session' }))

    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(screen.getByDisplayValue('Open Session')).toBeInTheDocument()
  })

  it('keeps project and session action menus available in mobile web layout', () => {
    const onRequestClose = vi.fn()
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Mobile Session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar isMobile onRequestClose={onRequestClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Project actions for project-a' }))
    expect(screen.getByRole('button', { name: 'Project memory' })).toBeInTheDocument()

    fireEvent.click(document.body)
    fireEvent.click(screen.getByRole('button', { name: 'Session actions for Mobile Session' }))
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
  })

  it('pins and unpins a project from the project context menu', () => {
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    fireEvent.contextMenu(screen.getByText('project-a'))
    fireEvent.click(screen.getByRole('button', { name: 'Pin project' }))
    expect(useProjectNavigationStore.getState().isPinned('/workspace/project-a')).toBe(true)

    fireEvent.contextMenu(screen.getByText('project-a'))
    fireEvent.click(screen.getByRole('button', { name: 'Unpin project' }))
    expect(useProjectNavigationStore.getState().isPinned('/workspace/project-a')).toBe(false)
  })

  it('forgets a project record from the project context menu without deleting sessions', async () => {
    removeProjectMock.mockResolvedValue({ ok: true, removed: true })
    fetchSessions.mockResolvedValue(undefined)
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Project A Task',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar />)

    fireEvent.contextMenu(screen.getByText('project-a'))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Forget project' }))
    })

    await waitFor(() => {
      expect(removeProjectMock).toHaveBeenCalledWith('/workspace/project-a')
      expect(fetchSessions).toHaveBeenCalled()
      expect(addToast).toHaveBeenCalledWith({
        type: 'success',
        message: 'Project removed from the list.',
      })
    })
    expect(deleteSession).not.toHaveBeenCalled()
    expect(deleteSessions).not.toHaveBeenCalled()
  })

  it('shows missing directories, running status, and supports inline rename', async () => {
    renameSession.mockResolvedValue(undefined)
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Running Session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T02:00:00.000Z',
          messageCount: 1,
          projectPath: '/workspace/project-a',
          workDir: '/workspace/project-a',
          workDirExists: false,
        },
      ],
    })
    useChatStore.setState({
      sessions: {
        'session-1': { chatState: 'running' },
      },
    } as unknown as Partial<ReturnType<typeof useChatStore.getState>>)
    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Running Session', type: 'session', status: 'running' }],
      activeTabId: 'session-1',
    })

    render(<Sidebar />)

    expect(screen.getByText('Missing')).toBeInTheDocument()
    expect(screen.getByLabelText('Session running')).toBeInTheDocument()

    fireEvent.contextMenu(getSessionMainButton(/Running Session/))
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByDisplayValue('Running Session')
    fireEvent.change(input, { target: { value: 'Renamed Session' } })

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(renameSession).toHaveBeenCalledWith('session-1', 'Renamed Session')
  })

  it('keeps mobile navigation focused on chat sessions', async () => {
    const onRequestClose = vi.fn()
    createSession.mockResolvedValue('session-mobile-new')
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Open Session',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          messageCount: 1,
          projectPath: '/workspace/project',
          workDir: '/workspace/project',
          workDirExists: true,
        },
      ],
    })

    render(<Sidebar isMobile onRequestClose={onRequestClose} />)

    expect(screen.queryByRole('button', { name: 'Scheduled' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()

    fireEvent.click(getSessionMainButton(/Open Session/))
    expect(onRequestClose).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Session' }))
    })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
    })
    expect(onRequestClose).toHaveBeenCalledTimes(2)
  })

  it('shows a loading state instead of an empty session list while initial fetch is pending', () => {
    useSessionStore.setState({ isLoading: true, sessions: [] })

    render(<Sidebar />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('No sessions')).not.toBeInTheDocument()
  })
})

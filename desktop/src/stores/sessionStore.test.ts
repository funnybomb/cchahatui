import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createMock, listMock, listProjectsMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  listMock: vi.fn(),
  listProjectsMock: vi.fn(),
}))

vi.mock('../api/sessions', () => ({
  sessionsApi: {
    create: createMock,
    list: listMock,
    delete: vi.fn(),
    rename: vi.fn(),
  },
}))

vi.mock('../api/projects', () => ({
  projectsApi: {
    list: listProjectsMock,
  },
}))

import { useSessionStore } from './sessionStore'
import { useTabStore } from './tabStore'

const initialState = useSessionStore.getState()

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('sessionStore', () => {
  beforeEach(() => {
    createMock.mockReset()
    listMock.mockReset()
    listProjectsMock.mockReset()
    listProjectsMock.mockResolvedValue({ projects: [] })
    useSessionStore.setState({
      ...initialState,
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,
      selectedProjects: [],
      availableProjects: [],
      pendingSessionIds: new Set(),
    })
    useTabStore.setState({ tabs: [], activeTabId: null })
  })

  afterEach(() => {
    useSessionStore.setState({ ...initialState, pendingSessionIds: new Set() })
    useTabStore.setState({ tabs: [], activeTabId: null })
  })

  it('returns a new session id before the background refresh completes', async () => {
    createMock.mockResolvedValue({ sessionId: 'session-optimistic-1' })
    listMock.mockImplementation(() => new Promise(() => {}))

    const result = await Promise.race([
      useSessionStore.getState().createSession('D:/workspace/code/myself_code/cc-haha'),
      delay(100).then(() => 'timed-out'),
    ])

    expect(result).toBe('session-optimistic-1')
    expect(useSessionStore.getState().activeSessionId).toBe('session-optimistic-1')
    expect(useSessionStore.getState().sessions[0]).toMatchObject({
      id: 'session-optimistic-1',
      title: 'New Session',
      projectPath: 'D:/workspace/code/myself_code/cc-haha',
      workDir: 'D:/workspace/code/myself_code/cc-haha',
      workDirExists: true,
    })
    expect(createMock).toHaveBeenCalledWith({
      workDir: 'D:/workspace/code/myself_code/cc-haha',
    })
    expect(listMock).toHaveBeenCalledOnce()
  })

  it('keeps an optimistic local title when a background refresh still returns a placeholder', async () => {
    const refresh = createDeferred<{
      sessions: Array<{
        id: string
        title: string
        createdAt: string
        modifiedAt: string
        messageCount: number
        projectPath: string
        workDir: string | null
        workDirExists: boolean
      }>
      total: number
    }>()
    createMock.mockResolvedValue({ sessionId: 'session-title-1', workDir: '/workspace/project' })
    listMock.mockReturnValue(refresh.promise)

    await useSessionStore.getState().createSession('/workspace/project')
    useSessionStore.getState().updateSessionTitle('session-title-1', '开始优化UI')

    refresh.resolve({
      sessions: [{
        id: 'session-title-1',
        title: 'Untitled Session',
        createdAt: '2026-05-07T00:00:00.000Z',
        modifiedAt: '2026-05-07T00:00:01.000Z',
        messageCount: 0,
        projectPath: '',
        workDir: '/workspace/project',
        workDirExists: true,
      }],
      total: 1,
    })
    await refresh.promise
    await delay(0)

    expect(useSessionStore.getState().sessions[0]?.title).toBe('开始优化UI')
  })

  it('hides persisted empty placeholder sessions from fetched history', async () => {
    listMock.mockResolvedValue({
      sessions: [
        {
          id: 'empty-placeholder',
          title: 'Untitled Session',
          createdAt: '2026-05-07T00:00:00.000Z',
          modifiedAt: '2026-05-07T00:00:01.000Z',
          messageCount: 0,
          projectPath: '',
          workDir: '/workspace/project',
          workDirExists: true,
        },
        {
          id: 'named-empty',
          title: 'Saved draft',
          createdAt: '2026-05-07T00:00:00.000Z',
          modifiedAt: '2026-05-07T00:00:02.000Z',
          messageCount: 0,
          projectPath: '',
          workDir: '/workspace/project',
          workDirExists: true,
        },
        {
          id: 'real-session',
          title: '开始优化UI',
          createdAt: '2026-05-07T00:00:00.000Z',
          modifiedAt: '2026-05-07T00:00:03.000Z',
          messageCount: 2,
          projectPath: '',
          workDir: '/workspace/project',
          workDirExists: true,
        },
      ],
      total: 3,
    })

    await useSessionStore.getState().fetchSessions()

    expect(useSessionStore.getState().sessions.map((session) => session.id)).toEqual([
      'named-empty',
      'real-session',
    ])
  })

  it('preserves the active optimistic session when refresh returns only its empty placeholder', async () => {
    createMock.mockResolvedValue({ sessionId: 'active-empty', workDir: '/workspace/project' })
    listMock.mockResolvedValue({
      sessions: [{
        id: 'active-empty',
        title: 'Untitled Session',
        createdAt: '2026-05-07T00:00:00.000Z',
        modifiedAt: '2026-05-07T00:00:01.000Z',
        messageCount: 0,
        projectPath: '',
        workDir: '/workspace/project',
        workDirExists: true,
      }],
      total: 1,
    })

    await useSessionStore.getState().createSession('/workspace/project')
    await delay(0)

    expect(useSessionStore.getState().sessions).toMatchObject([
      {
        id: 'active-empty',
        title: 'New Session',
        workDir: '/workspace/project',
      },
    ])
  })

  it('does not preserve a stale empty placeholder just because the legacy active session id still points at it', async () => {
    useSessionStore.setState({
      ...useSessionStore.getState(),
      activeSessionId: 'stale-empty',
      sessions: [{
        id: 'stale-empty',
        title: 'New Session',
        createdAt: '2026-05-07T00:00:00.000Z',
        modifiedAt: '2026-05-07T00:00:01.000Z',
        messageCount: 0,
        projectPath: '',
        workDir: '/workspace/project',
        workDirExists: true,
      }],
    })
    useTabStore.setState({
      tabs: [{
        sessionId: 'real-session',
        title: '已有历史',
        type: 'session',
        status: 'idle',
      }],
      activeTabId: 'real-session',
    })
    listMock.mockResolvedValue({
      sessions: [
        {
          id: 'stale-empty',
          title: 'Untitled Session',
          createdAt: '2026-05-07T00:00:00.000Z',
          modifiedAt: '2026-05-07T00:00:01.000Z',
          messageCount: 0,
          projectPath: '',
          workDir: '/workspace/project',
          workDirExists: true,
        },
        {
          id: 'real-session',
          title: '已有历史',
          createdAt: '2026-05-07T00:00:00.000Z',
          modifiedAt: '2026-05-07T00:00:02.000Z',
          messageCount: 2,
          projectPath: '',
          workDir: '/workspace/project',
          workDirExists: true,
        },
      ],
      total: 2,
    })

    await useSessionStore.getState().fetchSessions()

    expect(useSessionStore.getState().sessions.map((session) => session.id)).toEqual(['real-session'])
  })

  it('preserves a restored active empty tab even when it is not the legacy active session id', async () => {
    useTabStore.setState({
      tabs: [{
        sessionId: 'restored-empty',
        title: '恢复的草稿',
        type: 'session',
        status: 'idle',
      }],
      activeTabId: 'restored-empty',
    })
    listMock.mockResolvedValue({
      sessions: [{
        id: 'restored-empty',
        title: 'Untitled Session',
        createdAt: '2026-05-07T00:00:00.000Z',
        modifiedAt: '2026-05-07T00:00:01.000Z',
        messageCount: 0,
        projectPath: '',
        workDir: '/workspace/project',
        workDirExists: true,
      }],
      total: 1,
    })

    await useSessionStore.getState().fetchSessions()

    expect(useSessionStore.getState().sessions).toMatchObject([
      {
        id: 'restored-empty',
        title: '恢复的草稿',
        workDir: '/workspace/project',
      },
    ])
  })

  it('syncs refreshed session titles into already-open tabs', async () => {
    useTabStore.getState().openTab('session-title-2', '```json {"title":')
    listMock.mockResolvedValue({
      sessions: [{
        id: 'session-title-2',
        title: '使用bash写一个shell，随便写点什么东西',
        createdAt: '2026-05-07T00:00:00.000Z',
        modifiedAt: '2026-05-07T00:00:01.000Z',
        messageCount: 3,
        projectPath: '',
        workDir: '/workspace/project',
        workDirExists: true,
      }],
      total: 1,
    })

    await useSessionStore.getState().fetchSessions()

    expect(useTabStore.getState().tabs[0]?.title).toBe('使用bash写一个shell，随便写点什么东西')
    expect(useSessionStore.getState().availableProjects).toContain('/workspace/project')
  })

  it('forwards direct branch switch repository options when creating a session', async () => {
    createMock.mockResolvedValue({ sessionId: 'session-branch-switch', workDir: '/workspace/repo' })
    listMock.mockResolvedValue({ sessions: [], total: 0 })

    await useSessionStore.getState().createSession('/workspace/repo', {
      repository: { branch: 'feature/rail', worktree: false },
    })

    expect(createMock).toHaveBeenCalledWith({
      workDir: '/workspace/repo',
      repository: { branch: 'feature/rail', worktree: false },
    })
  })

  it('forwards isolated worktree repository options when creating a session', async () => {
    createMock.mockResolvedValue({
      sessionId: 'session-worktree-launch',
      workDir: '/workspace/repo/.claude/worktrees/desktop-feature-rail-12345678',
    })
    listMock.mockImplementation(() => new Promise(() => {}))

    await useSessionStore.getState().createSession('/workspace/repo', {
      repository: { branch: 'feature/rail', worktree: true },
    })

    expect(createMock).toHaveBeenCalledWith({
      workDir: '/workspace/repo',
      repository: { branch: 'feature/rail', worktree: true },
    })
    expect(useSessionStore.getState().sessions[0]?.workDir)
      .toBe('/workspace/repo/.claude/worktrees/desktop-feature-rail-12345678')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useChatStore } from '../stores/chatStore'
import { useSessionStore } from '../stores/sessionStore'
import { useTabStore } from '../stores/tabStore'
import { useUIStore } from '../stores/uiStore'

function Harness() {
  useKeyboardShortcuts()
  return null
}

describe('useKeyboardShortcuts', () => {
  const initialSessionState = useSessionStore.getInitialState()
  const initialChatState = useChatStore.getInitialState()
  const initialTabState = useTabStore.getInitialState()
  const initialUiState = useUIStore.getInitialState()
  const createSession = vi.fn()
  const connectToSession = vi.fn()
  const addToast = vi.fn()

  beforeEach(() => {
    createSession.mockReset()
    connectToSession.mockReset()
    addToast.mockReset()
    useSessionStore.setState(initialSessionState, true)
    useChatStore.setState(initialChatState, true)
    useTabStore.setState(initialTabState, true)
    useUIStore.setState(initialUiState, true)
    useUIStore.setState({ addToast } as Partial<ReturnType<typeof useUIStore.getState>>)
  })

  afterEach(() => {
    cleanup()
  })

  it('creates a new session in the active project with Cmd+N', async () => {
    createSession.mockResolvedValue('session-new')
    useSessionStore.setState({
      createSession,
      sessions: [{
        id: 'session-active',
        title: 'Active',
        createdAt: '2026-05-01T00:00:00.000Z',
        modifiedAt: '2026-05-01T00:00:00.000Z',
        messageCount: 1,
        projectPath: '/repo',
        workDir: '/repo',
        workDirExists: true,
      }],
    })
    useChatStore.setState({ connectToSession } as Partial<ReturnType<typeof useChatStore.getState>>)
    useTabStore.setState({
      activeTabId: 'session-active',
      tabs: [{ sessionId: 'session-active', title: 'Active', type: 'session', status: 'idle' }],
    })

    render(<Harness />)

    fireEvent.keyDown(document, { key: 'n', metaKey: true })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith('/repo')
      expect(connectToSession).toHaveBeenCalledWith('session-new')
    })
    expect(useTabStore.getState().activeTabId).toBe('session-new')
  })

  it('creates an unscoped session with Cmd+N when no project tab is active', async () => {
    createSession.mockResolvedValue('session-new')
    useSessionStore.setState({ createSession })
    useChatStore.setState({ connectToSession } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Harness />)

    fireEvent.keyDown(document, { key: 'n', metaKey: true })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith(undefined)
      expect(connectToSession).toHaveBeenCalledWith('session-new')
    })
  })

  it('shows a toast when Cmd+N cannot create a session', async () => {
    createSession.mockRejectedValue(new Error('boom'))
    useSessionStore.setState({ createSession })

    render(<Harness />)

    fireEvent.keyDown(document, { key: 'n', metaKey: true })

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'boom',
      })
    })
  })

  it('focuses the sidebar search with Cmd+K', async () => {
    render(
      <>
        <input id="sidebar-search" defaultValue="sessions" />
        <Harness />
      </>,
    )

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    await waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById('sidebar-search'))
    })
    expect((document.getElementById('sidebar-search') as HTMLInputElement).selectionStart).toBe(0)
  })

  it('toggles the sidebar with Cmd+B', () => {
    useUIStore.setState({ sidebarOpen: true })

    render(<Harness />)

    fireEvent.keyDown(document, { key: 'b', metaKey: true })

    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })

  it('dispatches a project memory event with Cmd+Shift+M', () => {
    const listener = vi.fn()
    window.addEventListener('cchahatui:open-project-memory', listener)

    render(<Harness />)

    fireEvent.keyDown(document, { key: 'M', metaKey: true, shiftKey: true })

    expect(listener).toHaveBeenCalled()
    window.removeEventListener('cchahatui:open-project-memory', listener)
  })

  it('dispatches a shortcut help event with Cmd+/', () => {
    const listener = vi.fn()
    window.addEventListener('cchahatui:open-shortcuts-help', listener)

    render(<Harness />)

    fireEvent.keyDown(document, { key: '/', metaKey: true })

    expect(listener).toHaveBeenCalled()
    window.removeEventListener('cchahatui:open-shortcuts-help', listener)
  })

  it('switches to a numbered tab with Cmd+1..9', () => {
    useTabStore.setState({
      activeTabId: 'session-1',
      tabs: [
        { sessionId: 'session-1', title: 'One', type: 'session', status: 'idle' },
        { sessionId: 'session-2', title: 'Two', type: 'session', status: 'idle' },
      ],
    })

    render(<Harness />)

    fireEvent.keyDown(document, { key: '2', metaKey: true })

    expect(useTabStore.getState().activeTabId).toBe('session-2')
  })
})

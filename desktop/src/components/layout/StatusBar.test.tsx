import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTabStore } from '../../stores/tabStore'
import { StatusBar } from './StatusBar'

describe('StatusBar', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,
    })
    useSettingsStore.setState({ currentModel: null })
    useTabStore.setState({ tabs: [], activeTabId: null })
  })

  it('shows a safe project label for sanitized project paths', () => {
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Private Path Session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T00:00:00.000Z',
          messageCount: 1,
          projectPath: '-Users-funnybomb-private-work-haha+tui',
          workDir: '/Users/funnybomb/private/work/haha+tui',
          workDirExists: true,
        },
      ],
    })
    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Private Path Session', type: 'session', status: 'idle' }],
      activeTabId: 'session-1',
    })

    render(<StatusBar />)

    expect(screen.getByText('haha+tui')).toBeInTheDocument()
    expect(screen.queryByText('-Users-funnybomb-private-work-haha+tui')).not.toBeInTheDocument()
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { useTabStore } from './tabStore'
import { useTeamStore } from './teamStore'
import { useChatStore } from './chatStore'

afterEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null })
  useTeamStore.getState().stopMemberPolling()
  useTeamStore.setState({ teams: [], activeTeam: null, memberColors: new Map(), error: null })
  useChatStore.setState({ sessions: {} })
  localStorage.clear()
})

describe('teamStore multi-agent tab state', () => {
  it('applies watcher updates when the server sends a sanitized team directory name', () => {
    useTeamStore.setState({
      teams: [{ name: 'My Team', memberCount: 2 }],
      activeTeam: {
        name: 'My Team',
        leadAgentId: 'team-lead@My Team',
        leadSessionId: 'leader-session',
        members: [
          {
            agentId: 'team-lead@My Team',
            role: 'team-lead',
            status: 'running',
            sessionId: 'leader-session',
          },
          {
            agentId: 'security-reviewer@My Team',
            role: 'security-reviewer',
            status: 'running',
          },
        ],
      },
      memberColors: new Map(),
      error: null,
    })

    useTeamStore.getState().handleTeamUpdate('my-team', [
      {
        agentId: 'security-reviewer@My Team',
        role: 'security-reviewer',
        status: 'idle',
      },
    ])

    const member = useTeamStore
      .getState()
      .activeTeam
      ?.members.find((entry) => entry.agentId === 'security-reviewer@My Team')
    expect(member?.status).toBe('idle')
  })

  it('closes synthetic member tabs when a sanitized team delete event arrives', () => {
    useTeamStore.setState({
      teams: [{ name: 'My Team', memberCount: 2 }],
      activeTeam: {
        name: 'My Team',
        leadAgentId: 'team-lead@My Team',
        leadSessionId: 'leader-session',
        members: [
          {
            agentId: 'team-lead@My Team',
            role: 'team-lead',
            status: 'running',
            sessionId: 'leader-session',
          },
          {
            agentId: 'security-reviewer@My Team',
            role: 'security-reviewer',
            status: 'running',
          },
        ],
      },
      memberColors: new Map(),
      error: null,
    })
    useTabStore.setState({
      tabs: [
        { sessionId: 'leader-session', title: 'Leader', type: 'session', status: 'idle' },
        { sessionId: 'team-member:security-reviewer@My Team', title: 'security-reviewer', type: 'session', status: 'idle' },
        { sessionId: '__settings__', title: 'Settings', type: 'settings', status: 'idle' },
      ],
      activeTabId: 'team-member:security-reviewer@My Team',
    })

    useTeamStore.getState().handleTeamDeleted('my-team')

    expect(useTeamStore.getState().activeTeam).toBeNull()
    expect(useTeamStore.getState().teams).toEqual([])
    expect(useTabStore.getState().tabs.map((tab) => tab.sessionId)).toEqual([
      'leader-session',
      '__settings__',
    ])
    expect(useTabStore.getState().activeTabId).toBe('leader-session')
  })
})

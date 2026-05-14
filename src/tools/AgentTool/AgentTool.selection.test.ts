import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { ToolUseContext } from '../../Tool.js'
import type { AppState } from '../../state/AppState.js'
import type { AgentDefinition } from './loadAgentsDir.js'

const spawnTeammateMock = mock(async (input: { agent_type?: string }) => ({
  data: {
    teammate_id: 'teammate-1',
    agent_id: 'agent-1',
    agent_type: input.agent_type,
    color: 'blue',
    tmux_session_name: 'session',
    tmux_window_name: 'window',
    tmux_pane_id: 'pane',
    is_splitpane: true,
    plan_mode_required: false,
  },
}))

mock.module('../shared/spawnMultiAgent.js', () => ({
  spawnTeammate: spawnTeammateMock,
}))

function makeAgent(
  agentType: string,
  overrides: Partial<AgentDefinition> = {},
): AgentDefinition {
  return {
    agentType,
    whenToUse: `Use ${agentType}`,
    source: 'built-in',
    baseDir: 'built-in',
    getSystemPrompt: () => `${agentType} prompt`,
    ...overrides,
  } as AgentDefinition
}

function makeContext(activeAgents: AgentDefinition[]): ToolUseContext {
  const toolPermissionContext = getEmptyToolPermissionContext()
  const appState = {
    toolPermissionContext,
    mcp: {
      clients: [],
      tools: [],
    },
    agentDefinitions: {
      activeAgents,
      allAgents: activeAgents,
    },
    tasks: {},
    agentNameRegistry: new Map(),
    kairosEnabled: false,
  } as unknown as AppState

  return {
    options: {
      commands: [],
      debug: false,
      mainLoopModel: 'test-model',
      tools: [],
      verbose: false,
      thinkingConfig: {},
      mcpClients: [],
      mcpResources: {},
      isNonInteractiveSession: false,
      agentDefinitions: {
        activeAgents,
        allAgents: activeAgents,
      },
    },
    abortController: new AbortController(),
    messages: [],
    readFileState: {} as ToolUseContext['readFileState'],
    getAppState: () => appState,
    setAppState: () => {},
    setInProgressToolUseIDs: () => {},
    setResponseLength: () => {},
    updateFileHistoryState: () => {},
    updateAttributionState: () => {},
    toolUseId: 'tool-use-test',
  } as unknown as ToolUseContext
}

describe('AgentTool agent selection', () => {
  afterEach(() => {
    spawnTeammateMock.mockClear()
    delete process.env.USER_TYPE
  })

  test('falls back stale subagent types before normal agent validation', async () => {
    const { AgentTool } = await import('./AgentTool.js')
    const context = makeContext([
      makeAgent('general-purpose', {
        requiredMcpServers: ['missing-mcp'],
      }),
      makeAgent('Explore'),
    ])

    await expect(AgentTool.call({
      description: 'write chapter',
      prompt: 'write it',
      subagent_type: 'writing',
    }, context, mock())).rejects.toThrow(
      "Agent 'general-purpose' requires MCP servers matching: missing-mcp.",
    )
  })

  test('falls back stale teammate agent types before spawning', async () => {
    process.env.USER_TYPE = 'ant'
    const { AgentTool } = await import('./AgentTool.js')
    const context = makeContext([
      makeAgent('general-purpose', { color: 'blue' }),
      makeAgent('Plan'),
    ])

    const result = await AgentTool.call({
      description: 'write chapter',
      prompt: 'write it',
      subagent_type: 'writing',
      team_name: 'book-team',
      name: 'writer',
    }, context, mock())

    expect(result.data.status).toBe('teammate_spawned')
    expect(spawnTeammateMock).toHaveBeenCalledTimes(1)
    expect(spawnTeammateMock.mock.calls[0]?.[0]).toMatchObject({
      agent_type: 'general-purpose',
      team_name: 'book-team',
      name: 'writer',
    })
  })
})

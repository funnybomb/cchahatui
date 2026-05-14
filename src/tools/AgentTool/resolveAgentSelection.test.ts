import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import type { ToolPermissionContext } from '../../Tool.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import type { AgentDefinition } from './loadAgentsDir.js'
import { resolveAgentSelection } from './resolveAgentSelection.js'

function makeAgent(agentType: string): AgentDefinition {
  return {
    agentType,
    whenToUse: `Use ${agentType}`,
    source: 'built-in',
    baseDir: 'built-in',
    getSystemPrompt: () => `${agentType} prompt`,
  }
}

describe('resolveAgentSelection', () => {
  test('falls back unknown requested agent types to general-purpose when available', () => {
    const result = resolveAgentSelection({
      requestedType: 'writing',
      allAgents: [GENERAL_PURPOSE_AGENT, makeAgent('Explore')],
      toolPermissionContext: getEmptyToolPermissionContext(),
    })

    expect(result.selectedAgent.agentType).toBe('general-purpose')
    expect(result.fallbackFrom).toBe('writing')
  })

  test('keeps exact requested agents when available', () => {
    const result = resolveAgentSelection({
      requestedType: 'Explore',
      allAgents: [GENERAL_PURPOSE_AGENT, makeAgent('Explore')],
      toolPermissionContext: getEmptyToolPermissionContext(),
    })

    expect(result.selectedAgent.agentType).toBe('Explore')
    expect(result.fallbackFrom).toBeUndefined()
  })

  test('does not use fallback agents outside the allowed agent list', () => {
    expect(() => resolveAgentSelection({
      requestedType: 'writing',
      allAgents: [GENERAL_PURPOSE_AGENT, makeAgent('Explore')],
      allowedAgentTypes: ['Explore'],
      toolPermissionContext: getEmptyToolPermissionContext(),
    })).toThrow("Agent type 'writing' not found. Available agents: Explore")
  })

  test('does not bypass permission-denied agent types', () => {
    const toolPermissionContext: ToolPermissionContext = {
      ...getEmptyToolPermissionContext(),
      alwaysDenyRules: {
        cliArg: ['Agent(writing)'],
      },
    }

    expect(() => resolveAgentSelection({
      requestedType: 'writing',
      allAgents: [GENERAL_PURPOSE_AGENT, makeAgent('writing')],
      toolPermissionContext,
    })).toThrow(
      "Agent type 'writing' has been denied by permission rule 'Agent(writing)' from cliArg.",
    )
  })
})

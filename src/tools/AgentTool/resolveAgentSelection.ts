import type { ToolPermissionContext } from '../../Tool.js'
import {
  filterDeniedAgents,
  getDenyRuleForAgent,
} from '../../utils/permissions/permissions.js'
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js'
import { AGENT_TOOL_NAME } from './constants.js'
import type { AgentDefinition } from './loadAgentsDir.js'

type ResolveAgentSelectionInput = {
  requestedType: string
  allAgents: AgentDefinition[]
  allowedAgentTypes?: string[]
  toolPermissionContext: ToolPermissionContext
}

type ResolvedAgentSelection = {
  selectedAgent: AgentDefinition
  availableAgents: AgentDefinition[]
  fallbackFrom?: string
}

export function resolveAgentSelection({
  requestedType,
  allAgents,
  allowedAgentTypes,
  toolPermissionContext,
}: ResolveAgentSelectionInput): ResolvedAgentSelection {
  const availableAgents = filterDeniedAgents(
    allowedAgentTypes
      ? allAgents.filter(agent => allowedAgentTypes.includes(agent.agentType))
      : allAgents,
    toolPermissionContext,
    AGENT_TOOL_NAME,
  )
  const found = availableAgents.find(agent => agent.agentType === requestedType)
  if (found) {
    return { selectedAgent: found, availableAgents }
  }

  const agentExistsButDenied = allAgents.find(agent => agent.agentType === requestedType)
  if (agentExistsButDenied) {
    const denyRule = getDenyRuleForAgent(
      toolPermissionContext,
      AGENT_TOOL_NAME,
      requestedType,
    )
    throw new Error(
      `Agent type '${requestedType}' has been denied by permission rule '${AGENT_TOOL_NAME}(${requestedType})' from ${denyRule?.source ?? 'settings'}.`,
    )
  }

  const fallbackAgent = requestedType === GENERAL_PURPOSE_AGENT.agentType
    ? undefined
    : availableAgents.find(agent => agent.agentType === GENERAL_PURPOSE_AGENT.agentType)
  if (fallbackAgent) {
    return {
      selectedAgent: fallbackAgent,
      availableAgents,
      fallbackFrom: requestedType,
    }
  }

  throw new Error(
    `Agent type '${requestedType}' not found. Available agents: ${availableAgents.map(agent => agent.agentType).join(', ')}`,
  )
}

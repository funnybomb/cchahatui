import type { ModelInfo } from '../types/settings'

export const OFFICIAL_DEFAULT_MODEL_ID = 'claude-opus-4-7'

export const OFFICIAL_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4-7',
    name: 'cc-tui Max',
    description: 'Official-compatible high capability model',
    context: '1m',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'cc-tui Standard',
    description: 'Official-compatible everyday model',
    context: '200k',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'cc-tui Fast',
    description: 'Official-compatible fast model',
    context: '200k',
  },
]

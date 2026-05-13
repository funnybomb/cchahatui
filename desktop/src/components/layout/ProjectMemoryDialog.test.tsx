import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ProjectMemoryDialog } from './ProjectMemoryDialog'
import { useProjectMemoryStore } from '../../stores/projectMemoryStore'
import { useUIStore } from '../../stores/uiStore'

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'sidebar.projectMemory': 'Project memory',
      'sidebar.projectMemoryHint': 'Saved notes are added as private context.',
      'sidebar.projectMemoryPlaceholder': 'Durable memory...',
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
    }
    let text = translations[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    }
    return text
  },
}))

describe('ProjectMemoryDialog', () => {
  const initialMemoryState = useProjectMemoryStore.getInitialState()
  const addToast = vi.fn()

  beforeEach(() => {
    window.localStorage.clear()
    addToast.mockReset()
    useProjectMemoryStore.setState(initialMemoryState, true)
    useUIStore.setState({ addToast } as Partial<ReturnType<typeof useUIStore.getState>>)
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    useProjectMemoryStore.setState(initialMemoryState, true)
  })

  it('saves structured same-project memory categories', () => {
    render(
      <ProjectMemoryDialog
        open
        projectPath="/workspace/project"
        projectTitle="project"
        onClose={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Project memory summary'), {
      target: { value: 'Prefer desktop smoke tests.' },
    })
    fireEvent.change(screen.getByPlaceholderText('One fact per line...'), {
      target: { value: 'Use Bun.\nUse Bun.' },
    })
    fireEvent.change(screen.getByPlaceholderText('One decision per line...'), {
      target: { value: 'Keep layout quiet.' },
    })
    fireEvent.change(screen.getByPlaceholderText('One open task per line...'), {
      target: { value: 'Run verify.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useProjectMemoryStore.getState().getMemory('/workspace/project')).toMatchObject({
      summary: 'Prefer desktop smoke tests.',
      sections: {
        facts: ['Use Bun.'],
        decisions: ['Keep layout quiet.'],
        openTasks: ['Run verify.'],
      },
      includeInContext: true,
    })
    expect(addToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'Project memory saved.',
    })
  })

  it('can exclude saved memory from future model context without clearing it', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/project', 'Keep this.', {
      facts: ['Use Bun.'],
    })

    render(
      <ProjectMemoryDialog
        open
        projectPath="/workspace/project"
        projectTitle="project"
        onClose={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: /Reuse in new chats/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const memory = useProjectMemoryStore.getState().getMemory('/workspace/project')
    expect(memory?.summary).toBe('Keep this.')
    expect(memory?.sections.facts).toEqual(['Use Bun.'])
    expect(memory?.includeInContext).toBe(false)
  })

  it('clears only the project memory entry with an explicit action', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/project', 'Keep this.')

    render(
      <ProjectMemoryDialog
        open
        projectPath="/workspace/project"
        projectTitle="project"
        onClose={() => {}}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Project memory' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear memory' }))

    expect(useProjectMemoryStore.getState().getMemory('/workspace/project')).toBeNull()
    expect(addToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'Project memory cleared.',
    })
  })
})

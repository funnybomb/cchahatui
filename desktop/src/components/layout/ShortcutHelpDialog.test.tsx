import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShortcutHelpDialog, formatShortcut, getShortcutHelpGroups } from './ShortcutHelpDialog'

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'common.close': 'Close',
      'shortcuts.title': 'Keyboard shortcuts',
      'shortcuts.subtitle': 'App-level shortcuts stay available across desktop and browser shells.',
      'shortcuts.group.navigation': 'Navigation',
      'shortcuts.group.project': 'Project',
      'shortcuts.group.chat': 'Chat',
      'shortcuts.newSession': 'New session in current project',
      'shortcuts.focusSearch': 'Focus sidebar search',
      'shortcuts.toggleSidebar': 'Toggle sidebar',
      'shortcuts.openHelp': 'Open shortcut help',
      'shortcuts.switchTabs': 'Switch tabs',
      'shortcuts.projectMemory': 'Open project memory',
      'shortcuts.stopGeneration': 'Stop generation',
      'shortcuts.closeDialog': 'Close dialog',
      'shortcuts.batchSelectVisible': 'Select visible sessions in batch mode',
    }
    return translations[key] ?? key
  },
}))

describe('ShortcutHelpDialog', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders grouped shortcut help with discoverable commands', () => {
    render(<ShortcutHelpDialog open onClose={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(within(dialog).getByText('Navigation')).toBeInTheDocument()
    expect(within(dialog).getByText('Project')).toBeInTheDocument()
    expect(within(dialog).getByText('Chat')).toBeInTheDocument()
    expect(within(dialog).getByText('New session in current project')).toBeInTheDocument()
    expect(within(dialog).getByText('Open project memory')).toBeInTheDocument()
    expect(within(dialog).getByText('Stop generation')).toBeInTheDocument()
  })

  it('keeps the shortcut registry explicit and grouped', () => {
    expect(getShortcutHelpGroups()).toHaveLength(3)
    expect(getShortcutHelpGroups().flatMap((group) => group.items.map((item) => item.labelKey))).toContain('shortcuts.openHelp')
  })

  it('formats shortcut labels for macOS and non-macOS shells', () => {
    expect(formatShortcut(['mod', 'shift', 'm'], true)).toBe('Cmd + Shift + M')
    expect(formatShortcut(['mod', '/'], false)).toBe('Ctrl + /')
  })
})

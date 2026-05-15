import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => ({
    'permMode.askPermissions': 'Ask permissions',
    'permMode.askPermDesc': 'Ask before changing files or running commands',
    'permMode.autoAccept': 'Auto accept edits',
    'permMode.autoAcceptDesc': 'Automatically accept edit operations',
    'permMode.planMode': 'Plan mode',
    'permMode.planModeDesc': 'Plan before executing',
    'permMode.bypass': 'Bypass permissions',
    'permMode.bypassDesc': 'Run without permission prompts',
    'permMode.executionPermissions': 'Execution Permissions',
    'permMode.label.default': 'Ask permissions',
    'permMode.label.acceptEdits': 'Auto accept edits',
    'permMode.label.plan': 'Plan mode',
    'permMode.label.bypassPermissions': 'Bypass permissions',
    'permMode.label.dontAsk': 'Bypass permissions',
    'permMode.enableBypassTitle': 'Enable bypass mode',
    'permMode.enableBypassSubtitle': 'This is risky',
    'permMode.enableBypassBody': 'Bypass permissions for this workspace.',
    'permMode.permReadWrite': 'Read and write files',
    'permMode.permShell': 'Run shell commands',
    'permMode.permPackages': 'Install packages',
    'permMode.enableBypassBtn': 'Enable bypass',
    'common.cancel': 'Cancel',
    'tabs.close': 'Close',
  }[key] ?? key),
}))

import { PermissionModeSelector } from './PermissionModeSelector'
import { useSettingsStore } from '../../stores/settingsStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useTabStore } from '../../stores/tabStore'

describe('PermissionModeSelector compact access', () => {
  beforeEach(() => {
    useSettingsStore.setState({ permissionMode: 'default' })
    useSessionStore.setState({ sessions: [], activeSessionId: null })
    useTabStore.setState({ activeTabId: null, tabs: [] })
  })

  it('labels the compact trigger and opens the desktop menu', () => {
    render(<PermissionModeSelector compact workDir="/repo" />)

    const trigger = screen.getByRole('button', { name: 'Ask permissions' })
    expect(trigger).toHaveClass('h-8', 'w-8')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', 'permission-mode-menu')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Auto accept edits/ })).toBeInTheDocument()
  })
})

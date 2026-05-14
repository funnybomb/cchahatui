import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { DESKTOP_UPDATE_REFRESH_INTERVAL_MS, UpdateChecker } from './UpdateChecker'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUpdateStore } from '../../stores/updateStore'

describe('UpdateChecker', () => {
  beforeEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(window, '__TAURI__')
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    useSettingsStore.setState({ locale: 'en' })
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      configurable: true,
    })

    useUpdateStore.setState({
      status: 'available',
      availableVersion: '0.1.5',
      releaseNotes: '# cchahatui v0.1.5\n\n[Release notes](https://example.com/releases/v0.1.5)',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders markdown release notes in the update prompt', () => {
    render(<UpdateChecker />)

    expect(screen.getByText('v0.1.5 available')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'cchahatui v0.1.5' })).toBeInTheDocument()

    const link = screen.getByRole('link', { name: 'Release notes' })
    expect(link).toHaveAttribute('href', 'https://example.com/releases/v0.1.5')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows downloaded bytes when the updater does not provide total size', () => {
    useUpdateStore.setState({
      status: 'downloading',
      availableVersion: '0.1.5',
      releaseNotes: '# cchahatui v0.1.5',
      progressPercent: 0,
      downloadedBytes: 1536,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })

    render(<UpdateChecker />)

    expect(screen.getByText('Downloading update... 1.5 KB downloaded')).toBeInTheDocument()
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
  })

  it('silently refreshes update checks while running in Tauri', async () => {
    vi.useFakeTimers()
    const initialize = vi.fn().mockResolvedValue(undefined)
    const checkForUpdates = vi.fn().mockResolvedValue(null)
    useUpdateStore.setState({
      initialize,
      checkForUpdates,
    })

    render(<UpdateChecker />)

    expect(initialize).toHaveBeenCalledTimes(1)
    expect(checkForUpdates).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_REFRESH_INTERVAL_MS)

    expect(checkForUpdates).toHaveBeenCalledTimes(1)
    expect(checkForUpdates).toHaveBeenCalledWith({ silent: true })
  })

  it('does not initialize or poll updates outside Tauri', async () => {
    vi.useFakeTimers()
    Reflect.deleteProperty(window, '__TAURI__')
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    const initialize = vi.fn().mockResolvedValue(undefined)
    const checkForUpdates = vi.fn().mockResolvedValue(null)
    useUpdateStore.setState({
      initialize,
      checkForUpdates,
    })

    render(<UpdateChecker />)
    await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_REFRESH_INTERVAL_MS)

    expect(initialize).not.toHaveBeenCalled()
    expect(checkForUpdates).not.toHaveBeenCalled()
  })

  it.each(['checking', 'downloading', 'restarting'] as const)(
    'skips silent refreshes while the updater is %s',
    async (status) => {
      vi.useFakeTimers()
      const checkForUpdates = vi.fn().mockResolvedValue(null)
      useUpdateStore.setState({
        status,
        checkForUpdates,
      })

      render(<UpdateChecker />)
      await vi.advanceTimersByTimeAsync(DESKTOP_UPDATE_REFRESH_INTERVAL_MS)

      expect(checkForUpdates).not.toHaveBeenCalled()
    },
  )
})

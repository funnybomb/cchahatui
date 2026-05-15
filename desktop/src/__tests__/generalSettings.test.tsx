import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'

import { Settings } from '../pages/Settings'
import { useSettingsStore } from '../stores/settingsStore'
import { useUIStore } from '../stores/uiStore'
import { useUpdateStore } from '../stores/updateStore'
import type { SavedProvider } from '../types/provider'
import type { ProviderPreset } from '../types/providerPreset'

const MOCK_DELETE_PROVIDER = vi.fn()
const MOCK_GET_SETTINGS = vi.fn()
const MOCK_UPDATE_SETTINGS = vi.fn()
const desktopNotificationsMock = vi.hoisted(() => ({
  getDesktopNotificationPermission: vi.fn(),
  notifyDesktop: vi.fn(),
  requestDesktopNotificationPermission: vi.fn(),
  openDesktopNotificationSettings: vi.fn(),
}))
const providerStoreState = {
  providers: [] as SavedProvider[],
  activeId: null as string | null,
  hasLoadedProviders: true,
  presets: [] as ProviderPreset[],
  isLoading: false,
  isPresetsLoading: false,
  fetchProviders: vi.fn(),
  fetchPresets: vi.fn(),
  deleteProvider: MOCK_DELETE_PROVIDER,
  activateProvider: vi.fn(),
  activateOfficial: vi.fn(),
  testProvider: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  testConfig: vi.fn(),
}

vi.mock('../api/agents', () => ({
  agentsApi: {
    list: vi.fn().mockResolvedValue({ activeAgents: [], allAgents: [] }),
  },
}))

vi.mock('../stores/providerStore', () => ({
  useProviderStore: () => providerStoreState,
}))

vi.mock('../api/providers', () => ({
  providersApi: {
    getSettings: MOCK_GET_SETTINGS,
    updateSettings: MOCK_UPDATE_SETTINGS,
  },
}))

vi.mock('../lib/desktopNotifications', () => desktopNotificationsMock)

vi.mock('../components/settings/CcTuiOfficialLogin', () => ({
  CcTuiOfficialLogin: () => <div data-testid="cctui-official-login" />,
}))

vi.mock('../pages/AdapterSettings', () => ({
  AdapterSettings: () => <div>Adapter Settings Mock</div>,
}))

vi.mock('../pages/ActivitySettings', () => ({
  ActivitySettings: () => <div>Activity Settings Mock</div>,
}))

vi.mock('../stores/agentStore', () => ({
  useAgentStore: () => ({
    activeAgents: [],
    allAgents: [],
    isLoading: false,
    error: null,
    selectedAgent: null,
    fetchAgents: vi.fn(),
    selectAgent: vi.fn(),
  }),
}))

vi.mock('../stores/skillStore', () => ({
  useSkillStore: () => ({
    skills: [],
    selectedSkill: null,
    isLoading: false,
    isDetailLoading: false,
    error: null,
    fetchSkills: vi.fn(),
    fetchSkillDetail: vi.fn(),
    clearSelection: vi.fn(),
  }),
}))

vi.mock('../components/chat/CodeViewer', () => ({
  CodeViewer: ({ code }: { code: string }) => <pre data-testid="code-viewer">{code}</pre>,
}))

describe('Settings > General tab', () => {
  beforeEach(() => {
    vi.useRealTimers()
    MOCK_DELETE_PROVIDER.mockReset()
    desktopNotificationsMock.getDesktopNotificationPermission.mockReset()
    desktopNotificationsMock.notifyDesktop.mockReset()
    desktopNotificationsMock.requestDesktopNotificationPermission.mockReset()
    desktopNotificationsMock.openDesktopNotificationSettings.mockReset()
    desktopNotificationsMock.getDesktopNotificationPermission.mockResolvedValue('default')
    desktopNotificationsMock.notifyDesktop.mockResolvedValue(true)
    desktopNotificationsMock.requestDesktopNotificationPermission.mockResolvedValue('granted')
    desktopNotificationsMock.openDesktopNotificationSettings.mockResolvedValue(true)
    MOCK_GET_SETTINGS.mockResolvedValue({})
    MOCK_UPDATE_SETTINGS.mockResolvedValue({})
    providerStoreState.providers = []
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = true
    providerStoreState.presets = []
    providerStoreState.isLoading = false
    providerStoreState.isPresetsLoading = false
    providerStoreState.fetchProviders = vi.fn()
    providerStoreState.fetchPresets = vi.fn()
    providerStoreState.activateProvider = vi.fn()
    providerStoreState.activateOfficial = vi.fn()
    providerStoreState.testProvider = vi.fn()
    providerStoreState.createProvider = vi.fn()
    providerStoreState.updateProvider = vi.fn()
    providerStoreState.testConfig = vi.fn()

    useSettingsStore.setState({
      locale: 'en',
      currentModel: {
        id: 'deepseek-v4-pro',
        name: 'deepseek-v4-pro',
        description: 'DeepSeek',
        context: '128k',
      },
      activeProviderName: 'DeepSeek',
      effortLevel: 'high',
      thinkingEnabled: true,
      skipWebFetchPreflight: true,
      desktopNotificationsEnabled: true,
      responseLanguage: '',
      webSearch: { mode: 'auto', tavilyApiKey: '', braveApiKey: '' },
      setThinkingEnabled: vi.fn().mockImplementation(async (enabled: boolean) => {
        useSettingsStore.setState({ thinkingEnabled: enabled })
      }),
      setSkipWebFetchPreflight: vi.fn().mockImplementation(async (enabled: boolean) => {
        useSettingsStore.setState({ skipWebFetchPreflight: enabled })
      }),
      setDesktopNotificationsEnabled: vi.fn().mockImplementation(async (enabled: boolean) => {
        useSettingsStore.setState({ desktopNotificationsEnabled: enabled })
      }),
      setResponseLanguage: vi.fn().mockImplementation(async (language: string) => {
        useSettingsStore.setState({ responseLanguage: language })
      }),
      setWebSearch: vi.fn().mockImplementation(async (webSearch) => {
        useSettingsStore.setState({ webSearch })
      }),
    })

    useUIStore.setState({ pendingSettingsTab: null })
    useUpdateStore.setState({
      status: 'idle',
      availableVersion: null,
      releaseNotes: null,
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: false,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })
  })

  it('shows WebFetch preflight toggle enabled by default', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Skip WebFetch domain preflight')
    expect(toggle).toBeChecked()
  })

  it('opens the Token usage tab from Settings navigation above Diagnostics', () => {
    render(<Settings />)

    const usageTab = screen.getByText('Token usage')
    const diagnosticsTab = screen.getByText('Diagnostics')
    expect((usageTab.compareDocumentPosition(diagnosticsTab) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)

    fireEvent.click(usageTab)

    expect(screen.getByText('Activity Settings Mock')).toBeInTheDocument()
  })

  it('lets the user disable WebFetch preflight skipping', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Skip WebFetch domain preflight')
    fireEvent.click(toggle)

    expect(useSettingsStore.getState().setSkipWebFetchPreflight).toHaveBeenCalledWith(false)
  })

  it('lets the user disable thinking mode for new sessions', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Enable thinking mode')
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)

    expect(useSettingsStore.getState().setThinkingEnabled).toHaveBeenCalledWith(false)
  })

  it('uses the shared dropdown for response language', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.queryByRole('combobox', { name: 'Response Language' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Response Language' })).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Response Language' })
    expect(trigger).toHaveTextContent('Default (English)')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: '中文 (Chinese)' }))

    expect(useSettingsStore.getState().setResponseLanguage).toHaveBeenCalledWith('chinese')
  })

  it('defaults the effort guidance to DeepSeek semantics', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByText(/DeepSeek supports thinking effort/)).toBeInTheDocument()
    expect(screen.getByText(/low and medium are compatibility-mapped to high/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'High' }).className).toContain('bg-[var(--color-brand)]')
  })

  it('updates effort guidance for non-DeepSeek models', () => {
    useSettingsStore.setState({
      currentModel: {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        description: 'OpenAI model',
        context: '400k',
      },
      activeProviderName: 'OpenAI',
    })

    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByText(/Current model GPT-5\.2 uses low\/medium\/high-style reasoning effort/)).toBeInTheDocument()
    expect(screen.queryByText(/DeepSeek supports thinking effort/)).not.toBeInTheDocument()
  })

  it('updates effort guidance for Claude-compatible providers', () => {
    useSettingsStore.setState({
      currentModel: {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        description: 'Anthropic model',
        context: '200k',
      },
      activeProviderName: 'Anthropic',
    })

    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByText(/Current model Claude Sonnet 4\.5 uses low\/medium\/high\/max as an effort preference/)).toBeInTheDocument()
  })

  it('uses generic effort guidance for other providers and falls back to provider name', () => {
    useSettingsStore.setState({
      currentModel: null,
      activeProviderName: 'Local Runtime',
    })

    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByText(/Current model Local Runtime receives effort according to provider capability/)).toBeInTheDocument()
  })

  it('lets the user disable desktop system notifications', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Enable system notifications')
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)

    expect(useSettingsStore.getState().setDesktopNotificationsEnabled).toHaveBeenCalledWith(false)
    expect(desktopNotificationsMock.requestDesktopNotificationPermission).not.toHaveBeenCalled()
  })

  it('requests native notification permission when desktop notifications are enabled', async () => {
    useSettingsStore.setState({ desktopNotificationsEnabled: false })
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Enable system notifications'))
    })

    expect(useSettingsStore.getState().setDesktopNotificationsEnabled).toHaveBeenCalledWith(true)
    await vi.waitFor(() => {
      expect(desktopNotificationsMock.requestDesktopNotificationPermission).toHaveBeenCalledTimes(1)
    })
    expect(desktopNotificationsMock.notifyDesktop).toHaveBeenCalledWith({
      title: 'cchahatui notifications are enabled',
      body: 'Permission prompts and completed agent replies will now use system notifications.',
    })
  })

  it('opens system settings when enabling notifications finds system denial', async () => {
    useSettingsStore.setState({ desktopNotificationsEnabled: false })
    desktopNotificationsMock.requestDesktopNotificationPermission.mockResolvedValue('denied')
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Enable system notifications'))
    })

    await vi.waitFor(() => {
      expect(desktopNotificationsMock.openDesktopNotificationSettings).toHaveBeenCalledTimes(1)
    })
  })

  it('saves WebSearch fallback provider settings', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    fireEvent.click(screen.getByRole('button', { name: 'Tavily' }))
    fireEvent.change(screen.getByLabelText('Tavily API key'), {
      target: { value: 'tvly-test-key' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useSettingsStore.getState().setWebSearch).toHaveBeenCalledWith({
      mode: 'tavily',
      tavilyApiKey: 'tvly-test-key',
      braveApiKey: '',
    })
  })

  it('links to WebSearch provider API key dashboards', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByRole('link', { name: 'Get Tavily API key' })).toHaveAttribute(
      'href',
      'https://app.tavily.com/home',
    )
    expect(screen.getByRole('link', { name: 'Get Brave Search API key' })).toHaveAttribute(
      'href',
      'https://api-dashboard.search.brave.com/app/keys',
    )
  })

  it('keeps extension tabs available alongside the terminal tab', () => {
    render(<Settings />)

    expect(screen.queryByText('Install')).not.toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('MCP')).toBeInTheDocument()
    expect(screen.getByText('Plugins')).toBeInTheDocument()
  })
})

describe('Settings > Providers tab', () => {
  beforeEach(() => {
    MOCK_DELETE_PROVIDER.mockReset()
    MOCK_GET_SETTINGS.mockResolvedValue({})
    MOCK_UPDATE_SETTINGS.mockResolvedValue({})
    providerStoreState.providers = [
      {
        id: 'provider-1',
        name: 'MiniMax-M2.7-highspeed(openai)',
        presetId: 'custom',
        apiKey: '***',
        baseUrl: 'https://api.minimaxi.com',
        apiFormat: 'openai_chat',
        models: {
          main: 'MiniMax-M2.7-highspeed',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        notes: '',
      },
    ]
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = true
  })

  it('does not query official OAuth status before providers finish loading', () => {
    providerStoreState.providers = []
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = false

    render(<Settings />)

    expect(screen.queryByTestId('cctui-official-login')).not.toBeInTheDocument()
  })

  it('shows official OAuth status only after official provider is confirmed active', () => {
    providerStoreState.providers = []
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = true

    render(<Settings />)

    expect(screen.getByTestId('cctui-official-login')).toBeInTheDocument()
  })

  it('requires confirmation before deleting a provider', async () => {
    render(<Settings />)

    await act(async () => {
      fireEvent.click(screen.getAllByText('Delete')[0]!)
      await Promise.resolve()
    })

    expect(MOCK_DELETE_PROVIDER).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete provider "MiniMax-M2.7-highspeed(openai)"? This cannot be undone.')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
      await Promise.resolve()
    })

    expect(MOCK_DELETE_PROVIDER).toHaveBeenCalledWith('provider-1')
  })

  it('uses the shared dropdown for API format in the provider form', () => {
    providerStoreState.presets = [
      {
        id: 'custom',
        name: 'Custom',
        baseUrl: 'https://api.example.com/anthropic',
        apiFormat: 'anthropic',
        defaultModels: {
          main: 'custom-main',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        needsApiKey: true,
        websiteUrl: '',
      },
    ]

    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Add Provider/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /cc-tui Messages \(native-compatible\)/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /OpenAI Responses API \(proxy\)/i }))

    expect(within(dialog).getByRole('button', { name: /OpenAI Responses API \(proxy\)/i })).toBeInTheDocument()
    expect(within(dialog).getByText('Requests will be translated via the local proxy')).toBeInTheDocument()
  })

  it('hides the API key by default and reveals it from the eye button', () => {
    providerStoreState.presets = [
      {
        id: 'custom',
        name: 'Custom',
        baseUrl: 'https://api.example.com/anthropic',
        apiFormat: 'anthropic',
        defaultModels: {
          main: 'custom-main',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        needsApiKey: true,
        websiteUrl: '',
      },
    ]

    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Add Provider/i }))

    const dialog = screen.getByRole('dialog')
    const apiKeyInput = within(dialog).getByPlaceholderText('sk-...')

    expect(apiKeyInput).toHaveAttribute('type', 'password')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Show API Key' }))

    expect(apiKeyInput).toHaveAttribute('type', 'text')
    expect(within(dialog).getByRole('button', { name: 'Hide API Key' })).toBeInTheDocument()
  })
})

describe('Settings > About tab', () => {
  beforeEach(() => {
    useUIStore.setState({ pendingSettingsTab: 'about' })
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '0.1.5',
      releaseNotes: '# cchahatui v0.1.5\n\n- Fixed updater rendering\n- Added markdown support',
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

  it('renders release notes with markdown formatting', async () => {
    render(<Settings />)

    expect(await screen.findByRole('heading', { name: 'cchahatui v0.1.5' })).toBeInTheDocument()
    expect(screen.getByText('Fixed updater rendering')).toBeInTheDocument()
    expect(screen.getByText('Added markdown support')).toBeInTheDocument()
  })

  it('shows downloaded bytes instead of a fake zero percent when total size is unknown', async () => {
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

    render(<Settings />)

    expect(await screen.findByText('Downloading update... 1.5 KB downloaded')).toBeInTheDocument()
    expect(screen.queryByText('Downloading update... 0%')).not.toBeInTheDocument()
  })
})

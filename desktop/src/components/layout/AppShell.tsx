import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { ContentRouter } from './ContentRouter'
import { ToastContainer } from '../shared/Toast'
import { UpdateChecker } from '../shared/UpdateChecker'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUIStore, type SettingsTab } from '../../stores/uiStore'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import {
  initializeDesktopServerUrl,
  isTauriRuntime,
} from '../../lib/desktopRuntime'
import { TabBar } from './TabBar'
import { StartupErrorView } from './StartupErrorView'
import { useTabStore, SETTINGS_TAB_ID } from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'
import { useTranslation } from '../../i18n'
import { ShortcutHelpDialog } from './ShortcutHelpDialog'

export function AppShell() {
  const fetchSettings = useSettingsStore((s) => s.fetchAll)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const [ready, setReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false)
  const t = useTranslation()
  const tauriRuntime = isTauriRuntime()

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (!cancelled) {
        setReady(false)
        setStartupError(null)
      }

      try {
        await initializeDesktopServerUrl()
        await fetchSettings()

        if (!cancelled) {
          setReady(true)
        }

        void (async () => {
          await useTabStore.getState().restoreTabs()
          if (cancelled) return
          const { activeTabId: activeId, tabs } = useTabStore.getState()
          const activeTab = tabs.find((tab) => tab.sessionId === activeId)
          if (activeId && activeTab?.type === 'session') {
            useChatStore.getState().connectToSession(activeId)
          }
        })().catch(() => {})
      } catch (error) {
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : String(error))
          setReady(false)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [fetchSettings, tauriRuntime])

  // Listen for macOS native menu navigation events (About / Settings)
  useEffect(() => {
    if (!tauriRuntime) return
    let unlisten: (() => void) | undefined
    import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<string>('native-menu-navigate', (event) => {
          const target = event.payload as SettingsTab | 'settings'
          if (target === 'about') {
            useUIStore.getState().setPendingSettingsTab('about')
          }
          useTabStore.getState().openTab(SETTINGS_TAB_ID, 'Settings', 'settings')
        }),
      )
      .then((fn) => { unlisten = fn })
      .catch(() => {})
    return () => { unlisten?.() }
  }, [])

  useKeyboardShortcuts()

  useEffect(() => {
    const openShortcutHelp = () => setShortcutHelpOpen(true)
    window.addEventListener('cchahatui:open-shortcuts-help', openShortcutHelp)
    return () => window.removeEventListener('cchahatui:open-shortcuts-help', openShortcutHelp)
  }, [])

  if (startupError) {
    return <StartupErrorView error={startupError} />
  }

  if (!ready) {
    return (
      <div className="app-shell-viewport flex items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
        {t('app.launching')}
      </div>
    )
  }

  return (
    <div className="app-shell app-shell-viewport flex overflow-hidden bg-[var(--color-surface)]">
      <div
        id="sidebar-shell"
        data-testid="sidebar-shell"
        data-state={sidebarOpen ? 'open' : 'closed'}
        className="sidebar-shell"
      >
        <Sidebar />
      </div>
      <main
        id="content-area"
        data-sidebar-state={sidebarOpen ? 'open' : 'closed'}
        className="min-w-0 flex-1 flex flex-col overflow-hidden"
      >
        <TabBar />
        <ContentRouter />
      </main>
      <ToastContainer />
      <UpdateChecker />
      <ShortcutHelpDialog open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
    </div>
  )
}

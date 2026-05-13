import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useChatStore } from '../stores/chatStore'
import { useTabStore } from '../stores/tabStore'
import { useUIStore } from '../stores/uiStore'

export function useKeyboardShortcuts() {
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const closeModal = useUIStore((s) => s.closeModal)
  const activeModal = useUIStore((s) => s.activeModal)
  const stopGeneration = useChatStore((s) => s.stopGeneration)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const chatState = useChatStore((s) => activeTabId ? s.sessions[activeTabId]?.chatState ?? 'idle' : 'idle')

  const activeModalRef = useRef(activeModal)
  activeModalRef.current = activeModal
  const chatStateRef = useRef(chatState)
  chatStateRef.current = chatState
  const activeTabIdRef = useRef(activeTabId)
  activeTabIdRef.current = activeTabId

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      // Cmd+N — New session
      if (meta && key === 'n') {
        e.preventDefault()
        const currentTabId = useTabStore.getState().activeTabId
        const currentSession = currentTabId
          ? useSessionStore.getState().sessions.find((session) => session.id === currentTabId)
          : null
        const workDir = currentSession?.workDir || currentSession?.projectPath || undefined
        useSessionStore.getState().createSession(workDir)
          .then((sessionId) => {
            useTabStore.getState().openTab(sessionId, 'New Session')
            useChatStore.getState().connectToSession(sessionId)
          })
          .catch((error) => {
            useUIStore.getState().addToast({
              type: 'error',
              message: error instanceof Error ? error.message : 'Failed to create session',
            })
          })
      }

      // Cmd+K — Focus search (sidebar search input)
      if (meta && key === 'k') {
        e.preventDefault()
        setSidebarOpen(true)
        requestAnimationFrame(() => {
          const searchInput = document.querySelector('#sidebar-search') as HTMLInputElement | null
          searchInput?.focus()
          searchInput?.select()
        })
      }

      // Cmd+B — Toggle sidebar
      if (meta && key === 'b') {
        e.preventDefault()
        toggleSidebar()
      }

      // Cmd+Shift+M — Open project memory for the active project
      if (meta && e.shiftKey && key === 'm') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('cchahatui:open-project-memory'))
      }

      // Cmd+/ — Open shortcut help
      if (meta && key === '/') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('cchahatui:open-shortcuts-help'))
      }

      // Cmd+1..9 — Switch open tabs
      if (meta && /^[1-9]$/.test(e.key)) {
        const index = Number(e.key) - 1
        const tab = useTabStore.getState().tabs[index]
        if (tab) {
          e.preventDefault()
          useTabStore.getState().setActiveTab(tab.sessionId)
        }
      }

      // Escape — Close modal or clear state
      if (e.key === 'Escape') {
        if (activeModalRef.current) {
          closeModal()
        }
      }

      // Cmd+. — Stop generation
      if (meta && e.key === '.') {
        if (chatStateRef.current !== 'idle' && activeTabIdRef.current) {
          e.preventDefault()
          stopGeneration(activeTabIdRef.current)
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [closeModal, setSidebarOpen, stopGeneration, toggleSidebar])
}

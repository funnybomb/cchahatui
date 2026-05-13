import { useMemo } from 'react'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type ShortcutHelpDialogProps = {
  open: boolean
  onClose: () => void
}

type ShortcutItem = {
  keys: string[]
  labelKey: TranslationKey
}

type ShortcutGroup = {
  titleKey: TranslationKey
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    titleKey: 'shortcuts.group.navigation',
    items: [
      { keys: ['mod', 'n'], labelKey: 'shortcuts.newSession' },
      { keys: ['mod', 'k'], labelKey: 'shortcuts.focusSearch' },
      { keys: ['mod', 'b'], labelKey: 'shortcuts.toggleSidebar' },
      { keys: ['mod', '/'], labelKey: 'shortcuts.openHelp' },
      { keys: ['mod', '1-9'], labelKey: 'shortcuts.switchTabs' },
    ],
  },
  {
    titleKey: 'shortcuts.group.project',
    items: [
      { keys: ['mod', 'shift', 'm'], labelKey: 'shortcuts.projectMemory' },
    ],
  },
  {
    titleKey: 'shortcuts.group.chat',
    items: [
      { keys: ['mod', '.'], labelKey: 'shortcuts.stopGeneration' },
      { keys: ['esc'], labelKey: 'shortcuts.closeDialog' },
      { keys: ['mod', 'a'], labelKey: 'shortcuts.batchSelectVisible' },
    ],
  },
]

export function getShortcutHelpGroups() {
  return SHORTCUT_GROUPS
}

export function formatShortcut(keys: string[], isMac: boolean) {
  return keys
    .map((key) => {
      if (key === 'mod') return isMac ? 'Cmd' : 'Ctrl'
      if (key === 'shift') return 'Shift'
      if (key === 'esc') return 'Esc'
      return key.length === 1 ? key.toUpperCase() : key
    })
    .join(' + ')
}

export function ShortcutHelpDialog({ open, onClose }: ShortcutHelpDialogProps) {
  const t = useTranslation()
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return true
    return /Mac|iPhone|iPad/.test(navigator.platform)
  }, [])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('shortcuts.title')}
      width={640}
      footer={(
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      )}
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
          {t('shortcuts.subtitle')}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.titleKey} className="min-w-0">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-normal text-[var(--color-text-tertiary)]">
                {t(group.titleKey)}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={`${group.titleKey}:${item.labelKey}`}
                    className="flex min-h-9 items-center justify-between gap-3 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-2.5 py-1.5"
                  >
                    <span className="min-w-0 text-[13px] leading-5 text-[var(--color-text-primary)]">
                      {t(item.labelKey)}
                    </span>
                    <kbd className="shrink-0 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-semibold leading-none text-[var(--color-text-secondary)]">
                      {formatShortcut(item.keys, isMac)}
                    </kbd>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  )
}

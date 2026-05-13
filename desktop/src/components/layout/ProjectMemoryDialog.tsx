import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { useProjectMemoryStore } from '../../stores/projectMemoryStore'
import { useUIStore } from '../../stores/uiStore'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type ProjectMemoryDialogProps = {
  open: boolean
  projectPath: string
  projectTitle: string
  onClose: () => void
}

export function ProjectMemoryDialog({ open, projectPath, projectTitle, onClose }: ProjectMemoryDialogProps) {
  const t = useTranslation()
  const memory = useProjectMemoryStore((s) => s.memories[projectPath])
  const setMemory = useProjectMemoryStore((s) => s.setMemory)
  const clearMemory = useProjectMemoryStore((s) => s.clearMemory)
  const addToast = useUIStore((s) => s.addToast)
  const [summary, setSummary] = useState('')

  useEffect(() => {
    if (!open) return
    setSummary(memory?.summary ?? '')
  }, [memory?.summary, open, projectPath])

  const handleSave = () => {
    setMemory(projectPath, summary)
    addToast({
      type: 'success',
      message: summary.trim() ? t('sidebar.projectMemorySaved') : t('sidebar.projectMemoryCleared'),
    })
    onClose()
  }

  const handleClear = () => {
    clearMemory(projectPath)
    setSummary('')
    addToast({ type: 'success', message: t('sidebar.projectMemoryCleared') })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sidebar.projectMemory')}
      width={560}
      footer={(
        <>
          <Button variant="ghost" onClick={handleClear} disabled={!memory?.summary && !summary.trim()}>
            {t('common.delete')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('common.save')}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{projectTitle}</div>
          <div className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]" title={projectPath}>
            {projectPath}
          </div>
        </div>
        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
          {t('sidebar.projectMemoryHint')}
        </p>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={t('sidebar.projectMemoryPlaceholder')}
          className="min-h-[180px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-sm leading-6 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
        />
      </div>
    </Modal>
  )
}

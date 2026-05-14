import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { sanitizeProjectMemoryDraft, useProjectMemoryStore } from '../../stores/projectMemoryStore'
import { useUIStore } from '../../stores/uiStore'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'

type ProjectMemoryDialogProps = {
  open: boolean
  projectPath: string
  projectTitle: string
  onClose: () => void
}

function linesToText(lines: string[] | undefined) {
  return (lines ?? []).join('\n')
}

function textToLines(text: string) {
  return [...new Set(text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean))]
}

export function ProjectMemoryDialog({ open, projectPath, projectTitle, onClose }: ProjectMemoryDialogProps) {
  const t = useTranslation()
  const memory = useProjectMemoryStore((s) => s.memories[projectPath])
  const setMemory = useProjectMemoryStore((s) => s.setMemory)
  const clearMemory = useProjectMemoryStore((s) => s.clearMemory)
  const addToast = useUIStore((s) => s.addToast)
  const [summary, setSummary] = useState('')
  const [facts, setFacts] = useState('')
  const [decisions, setDecisions] = useState('')
  const [openTasks, setOpenTasks] = useState('')
  const [includeInContext, setIncludeInContext] = useState(true)

  useEffect(() => {
    if (!open) return
    setSummary(memory?.summary ?? '')
    setFacts(linesToText(memory?.sections.facts))
    setDecisions(linesToText(memory?.sections.decisions))
    setOpenTasks(linesToText(memory?.sections.openTasks))
    setIncludeInContext(memory?.includeInContext ?? true)
  }, [
    memory?.includeInContext,
    memory?.sections.decisions,
    memory?.sections.facts,
    memory?.sections.openTasks,
    memory?.summary,
    open,
    projectPath,
  ])

  const handleSave = () => {
    const sanitized = sanitizeProjectMemoryDraft(summary, {
      facts: textToLines(facts),
      decisions: textToLines(decisions),
      openTasks: textToLines(openTasks),
    })
    setMemory(
      projectPath,
      sanitized.summary,
      sanitized.sections,
      includeInContext,
    )
    addToast({
      type: sanitized.blockedCount > 0 ? 'warning' : 'success',
      message: sanitized.blockedCount > 0
        ? t('sidebar.projectMemoryRestrictedSkipped', { count: sanitized.blockedCount })
        : summary.trim() || facts.trim() || decisions.trim() || openTasks.trim()
          ? t('sidebar.projectMemorySaved')
          : t('sidebar.projectMemoryCleared'),
    })
    onClose()
  }

  const handleClear = () => {
    clearMemory(projectPath)
    setSummary('')
    addToast({ type: 'success', message: t('sidebar.projectMemoryCleared') })
    onClose()
  }

  const updatedAtLabel = memory?.updatedAt
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(memory.updatedAt))
    : t('sidebar.projectMemoryNeverUpdated')
  const characterCount = [summary, facts, decisions, openTasks].join('\n').trim().length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sidebar.projectMemory')}
      width={560}
      footer={(
        <>
          <Button variant="ghost" onClick={handleClear} disabled={!memory?.summary && !summary.trim()}>
            {t('sidebar.projectMemoryClear')}
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
        <label className="flex items-start gap-2 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={includeInContext}
            onChange={(event) => setIncludeInContext(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="block font-medium text-[var(--color-text-primary)]">
              {t('sidebar.projectMemoryIncludeInContext')}
            </span>
            <span className="mt-0.5 block leading-5">
              {t('sidebar.projectMemoryIncludeInContextHint')}
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--color-surface-container)] px-2 py-1">
            <span className="material-symbols-outlined text-[13px]">schedule</span>
            {t('sidebar.projectMemoryUpdatedAt', { time: updatedAtLabel })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-[var(--color-surface-container)] px-2 py-1">
            <span className="material-symbols-outlined text-[13px]">notes</span>
            {t('sidebar.projectMemoryCharacters', { count: characterCount })}
          </span>
        </div>
        <textarea
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder={t('sidebar.projectMemoryPlaceholder')}
          aria-label={t('sidebar.projectMemorySummary')}
          className="min-h-[180px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-sm leading-6 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
        />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {t('sidebar.projectMemoryFacts')}
            </span>
            <textarea
              value={facts}
              onChange={(event) => setFacts(event.target.value)}
              placeholder={t('sidebar.projectMemoryFactsPlaceholder')}
              className="min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-xs leading-5 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {t('sidebar.projectMemoryDecisions')}
            </span>
            <textarea
              value={decisions}
              onChange={(event) => setDecisions(event.target.value)}
              placeholder={t('sidebar.projectMemoryDecisionsPlaceholder')}
              className="min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-xs leading-5 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {t('sidebar.projectMemoryOpenTasks')}
            </span>
            <textarea
              value={openTasks}
              onChange={(event) => setOpenTasks(event.target.value)}
              placeholder={t('sidebar.projectMemoryOpenTasksPlaceholder')}
              className="min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-xs leading-5 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)]"
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}

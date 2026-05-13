import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  DESKTOP_PREVIEW_END,
  DESKTOP_PREVIEW_START,
  listDesktopPreviewItems,
  renderDesktopPreviewTable,
  replaceDesktopPreviewBlock,
  updateDesktopPreviewReadmes,
} from './update-desktop-preview.mjs'

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'desktop-preview-'))
}

describe('desktop preview README generation', () => {
  test('lists screenshot images by numeric prefix', () => {
    const dir = tempDir()
    writeFileSync(path.join(dir, '10_desktop_workspace.png'), '')
    writeFileSync(path.join(dir, '02_edit_code.png'), '')
    writeFileSync(path.join(dir, 'README.md'), '')
    writeFileSync(path.join(dir, '09_file_search.webp'), '')

    expect(listDesktopPreviewItems(dir).map((item) => item.fileName)).toEqual([
      '02_edit_code.png',
      '09_file_search.webp',
      '10_desktop_workspace.png',
    ])
  })

  test('renders known labels and fallback labels', () => {
    const html = renderDesktopPreviewTable([
      { fileName: '02_edit_code.png', key: '02_edit_code' },
      { fileName: '99_new_panel.png', key: '99_new_panel' },
    ], 'zh', { columns: 2 })

    expect(html).toContain('代码编辑 &amp; Diff')
    expect(html).toContain('New Panel')
    expect(html).toContain('width="50%"')
  })

  test('replaces existing generated markers', () => {
    const next = `${DESKTOP_PREVIEW_START}\nnext\n${DESKTOP_PREVIEW_END}`
    const content = [
      'before',
      DESKTOP_PREVIEW_START,
      'old',
      DESKTOP_PREVIEW_END,
      'after',
    ].join('\n')

    expect(replaceDesktopPreviewBlock(content, next, '## Desktop Preview')).toBe([
      'before',
      next,
      'after',
    ].join('\n\n'))
  })

  test('updates README targets in place and supports check mode', () => {
    const dir = tempDir()
    const imageDir = path.join(dir, 'images')
    mkdirSync(imageDir)
    writeFileSync(path.join(imageDir, '01_full_ui.png'), '')
    writeFileSync(path.join(imageDir, '02_edit_code.png'), '')

    const readme = path.join(dir, 'README.md')
    writeFileSync(readme, [
      '# Test',
      '',
      '## Desktop Preview',
      '',
      '<table>',
      '  <tr><td>old</td></tr>',
      '</table>',
      '',
      '---',
    ].join('\n'))

    const targets = [{ file: readme, heading: '## Desktop Preview', lang: 'en' }]
    expect(updateDesktopPreviewReadmes({ imageDir, targets, check: true })).toEqual([readme])
    expect(readFileSync(readme, 'utf8')).toContain('<td>old</td>')

    expect(updateDesktopPreviewReadmes({ imageDir, targets })).toEqual([readme])
    const next = readFileSync(readme, 'utf8')
    expect(next).toContain(DESKTOP_PREVIEW_START)
    expect(next).toContain('Full Workspace')
    expect(next).toContain('Code Editing &amp; Diff')
    expect(updateDesktopPreviewReadmes({ imageDir, targets, check: true })).toEqual([])
  })
})

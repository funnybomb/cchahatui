/**
 * Filesystem browser & search API — supports directory browsing and file search
 * for the DirectoryPicker component and @-triggered file search popup.
 */

import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { execFileNoThrow } from '../../utils/execFileNoThrow.js'

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
}

type NativeFolderChooser = (title: string) => Promise<string | null>
type NativeFolderDialogRuntime = {
  platform?: NodeJS.Platform
  execFile?: typeof execFileNoThrow
}

let nativeFolderChooser: NativeFolderChooser = chooseFolderWithSystemDialog
let nativeFolderDialogPlatform: NodeJS.Platform = process.platform
let nativeFolderDialogExecFile = execFileNoThrow

export function setNativeFolderChooserForTests(chooser: NativeFolderChooser | null) {
  nativeFolderChooser = chooser ?? chooseFolderWithSystemDialog
}

export function setNativeFolderDialogRuntimeForTests(runtime: NativeFolderDialogRuntime | null) {
  nativeFolderDialogPlatform = runtime?.platform ?? process.platform
  nativeFolderDialogExecFile = runtime?.execFile ?? execFileNoThrow
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const target = normalizeComparablePath(targetPath)
  const root = normalizeComparablePath(rootPath)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

function normalizeComparablePath(filePath: string): string {
  const resolved = path.resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isAllowedFilesystemPath(targetPath: string): boolean {
  const resolvedPath = path.resolve(targetPath)
  const homeDir = path.resolve(os.homedir())

  if (isWithinRoot(resolvedPath, homeDir) || isWithinRoot(resolvedPath, '/tmp')) {
    return true
  }

  // macOS reports /tmp as /private/tmp via native folder pickers and realpath().
  if (process.platform === 'darwin' && isWithinRoot(resolvedPath, '/private/tmp')) {
    return true
  }

  return false
}

export async function handleFilesystemRoute(pathname: string, url: URL, req?: Request): Promise<Response> {
  if (pathname === '/api/filesystem/browse') {
    return handleBrowse(url)
  }

  if (pathname === '/api/filesystem/choose-folder') {
    return handleChooseFolder(url, req)
  }

  if (pathname === '/api/filesystem/file') {
    return handleServeFile(url)
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
}

async function handleChooseFolder(url: URL, req?: Request): Promise<Response> {
  if ((req?.method ?? 'GET') !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!isLoopbackHost(url.hostname)) {
    return json({ error: 'Native folder selection is only available from localhost' }, 403)
  }

  try {
    const title = url.searchParams.get('title') || 'Choose project folder'
    const selectedPath = await nativeFolderChooser(title)
    return json({ path: selectedPath })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return json({ error: message || 'Native folder selection failed' }, 500)
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
}

async function chooseFolderWithSystemDialog(title: string): Promise<string | null> {
  if (nativeFolderDialogPlatform === 'darwin') {
    return chooseFolderWithAppleScript(title)
  }

  if (nativeFolderDialogPlatform === 'win32') {
    return chooseFolderWithPowerShell(title)
  }

  return chooseFolderWithZenity(title)
}

async function chooseFolderWithAppleScript(title: string): Promise<string | null> {
  const result = await nativeFolderDialogExecFile(
    'osascript',
    ['-e', `POSIX path of (choose folder with prompt ${quoteAppleScriptString(title)})`],
    { useCwd: false },
  )

  if (result.code !== 0) {
    if (isUserCancelled(result.stderr) || isUserCancelled(result.error)) return null
    throw new Error(result.stderr || result.error || 'Finder folder picker failed')
  }

  return normalizeSelectedFolderPath(result.stdout)
}

async function chooseFolderWithPowerShell(title: string): Promise<string | null> {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    `$dialog.Description = ${quotePowerShellString(title)}`,
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.SelectedPath }',
  ].join('; ')
  const result = await nativeFolderDialogExecFile(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { useCwd: false },
  )

  if (result.code !== 0) {
    if (isUserCancelled(result.stderr) || isUserCancelled(result.error)) return null
    throw new Error(result.stderr || result.error || 'Windows folder picker failed')
  }

  return normalizeSelectedFolderPath(result.stdout)
}

async function chooseFolderWithZenity(title: string): Promise<string | null> {
  const result = await nativeFolderDialogExecFile(
    'zenity',
    ['--file-selection', '--directory', '--title', title],
    { useCwd: false },
  )

  if (result.code !== 0) {
    if (isUserCancelled(result.stderr) || isUserCancelled(result.error)) return null
    throw new Error(result.stderr || result.error || 'Native folder picker is unavailable')
  }

  return normalizeSelectedFolderPath(result.stdout)
}

function normalizeSelectedFolderPath(stdout: string): string | null {
  const selectedPath = stdout.trim()
  return selectedPath ? path.resolve(selectedPath) : null
}

function isUserCancelled(message: string | undefined): boolean {
  return Boolean(message && /cancel|canceled|cancelled|user cancelled|用户取消/i.test(message))
}

function quoteAppleScriptString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function quotePowerShellString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

async function handleServeFile(url: URL): Promise<Response> {
  const filePath = url.searchParams.get('path')
  if (!filePath) {
    return json({ error: 'Missing path parameter' }, 400)
  }

  const resolvedPath = path.resolve(filePath)

  if (!isAllowedFilesystemPath(resolvedPath)) {
    return json({ error: 'Access denied: path outside allowed directory' }, 403)
  }

  const ext = path.extname(resolvedPath).toLowerCase()
  const mimeType = IMAGE_MIME_TYPES[ext]

  if (!mimeType) {
    return json({ error: 'Unsupported file type' }, 400)
  }

  try {
    const stat = fs.statSync(resolvedPath)
    if (!stat.isFile()) {
      return json({ error: 'Not a file' }, 400)
    }
    // Limit to 50MB
    if (stat.size > 50 * 1024 * 1024) {
      return json({ error: 'File too large' }, 400)
    }

    const data = fs.readFileSync(resolvedPath)
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return json({ error: 'File not found' }, 404)
  }
}

async function handleBrowse(url: URL): Promise<Response> {
  const targetPath = url.searchParams.get('path') || os.homedir() || '/'
  const resolvedPath = path.resolve(targetPath)

  if (!isAllowedFilesystemPath(resolvedPath)) {
    return json({ error: 'Access denied: path outside allowed directory' }, 403)
  }

  const searchQuery = url.searchParams.get('search') || ''
  const includeFiles = url.searchParams.get('includeFiles') === 'true'
  const maxResults = Math.min(parseInt(url.searchParams.get('maxResults') || '200', 10), 200)

  try {
    const stat = fs.statSync(resolvedPath)
    if (!stat.isDirectory()) {
      return json({ error: 'Not a directory', path: resolvedPath }, 400)
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true })

    if (searchQuery) {
      // Search mode: filter by filename, include both dirs and files
      const query = searchQuery.toLowerCase()
      const results = entries
        .filter((e) => {
          if (e.name.startsWith('.')) return false
          if (e.isDirectory()) return e.name.toLowerCase().includes(query)
          if (!includeFiles) return false
          return e.name.toLowerCase().includes(query)
        })
        .slice(0, maxResults)
        .map((e) => ({
          name: e.name,
          path: path.join(resolvedPath, e.name),
          isDirectory: e.isDirectory(),
        }))
        .sort((a, b) => {
          // Directories first, then alphabetically
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })

      return json({
        currentPath: resolvedPath,
        parentPath: path.dirname(resolvedPath),
        entries: results,
        query: searchQuery,
      })
    }

    // Browse mode: show all directories (and optionally files)
    const filtered = entries.filter((e) => {
      if (e.name.startsWith('.')) return false
      if (e.isDirectory()) return true
      return includeFiles
    })

    const entries_list = filtered
      .map((e) => ({
        name: e.name,
        path: path.join(resolvedPath, e.name),
        isDirectory: e.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    return json({
      currentPath: resolvedPath,
      parentPath: path.dirname(resolvedPath),
      entries: entries_list,
    })
  } catch (err) {
    return json({ error: `Cannot read directory: ${err}`, path: resolvedPath }, 500)
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

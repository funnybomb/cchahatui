import { afterEach, describe, expect, it } from 'bun:test'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { handleFilesystemRoute, setNativeFolderChooserForTests, setNativeFolderDialogRuntimeForTests } from '../api/filesystem.js'
import { handleApiRequest } from '../router.js'

const cleanupDirs = new Set<string>()

function makeUrl(route: string, params: Record<string, string>): URL {
  const url = new URL(`http://localhost${route}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

afterEach(async () => {
  setNativeFolderChooserForTests(null)
  setNativeFolderDialogRuntimeForTests(null)
  for (const dir of cleanupDirs) {
    await fsp.rm(dir, { recursive: true, force: true })
  }
  cleanupDirs.clear()
})

describe('filesystem API', () => {
  it('allows browsing a directory under the user home directory', async () => {
    const homeFixtureDir = await fsp.mkdtemp(path.join(os.homedir(), 'claude-filesystem-test-'))
    cleanupDirs.add(homeFixtureDir)
    await fsp.writeFile(path.join(homeFixtureDir, 'note.txt'), 'hello')

    const res = await handleFilesystemRoute(
      '/api/filesystem/browse',
      makeUrl('/api/filesystem/browse', {
        path: homeFixtureDir,
        includeFiles: 'true',
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json() as { entries: Array<{ name: string }> }
    expect(body.entries.some((entry) => entry.name === 'note.txt')).toBe(true)
  })

  it('accepts /private/tmp aliases on macOS for browsing and file serving', async () => {
    if (process.platform !== 'darwin') return

    const tmpFixtureDir = await fsp.mkdtemp('/tmp/claude-filesystem-test-')
    cleanupDirs.add(tmpFixtureDir)
    const canonicalTmpDir = fs.realpathSync(tmpFixtureDir)
    const imagePath = path.join(canonicalTmpDir, 'preview.png')
    await fsp.writeFile(
      imagePath,
      Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c63606060000000040001f61738550000000049454e44ae426082', 'hex'),
    )

    const browseRes = await handleFilesystemRoute(
      '/api/filesystem/browse',
      makeUrl('/api/filesystem/browse', {
        path: canonicalTmpDir,
        includeFiles: 'true',
      }),
    )
    expect(browseRes.status).toBe(200)
    const browseBody = await browseRes.json() as { entries: Array<{ name: string }> }
    expect(browseBody.entries.some((entry) => entry.name === 'preview.png')).toBe(true)

    const fileRes = await handleFilesystemRoute(
      '/api/filesystem/file',
      makeUrl('/api/filesystem/file', {
        path: imagePath,
      }),
    )
    expect(fileRes.status).toBe(200)
    expect(fileRes.headers.get('Content-Type')).toBe('image/png')
  })

  it('opens the native folder chooser only for localhost API calls', async () => {
    const selectedPath = path.join(os.homedir(), 'project-from-picker')
    setNativeFolderChooserForTests(async () => selectedPath)

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      makeUrl('/api/filesystem/choose-folder', {
        title: 'Choose project folder',
      }),
      new Request('http://localhost/api/filesystem/choose-folder', { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: selectedPath })
  })

  it('routes native folder chooser calls through the main API router', async () => {
    setNativeFolderChooserForTests(async () => '/tmp/project-from-router')
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleApiRequest(
      new Request(url, { method: 'POST' }),
      url,
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: '/tmp/project-from-router' })
  })

  it('rejects non-POST native folder chooser calls', async () => {
    const url = new URL('http://localhost/api/filesystem/choose-folder')
    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'GET' }),
    )

    expect(res.status).toBe(405)
  })

  it('returns native folder chooser failures as a 500 response', async () => {
    setNativeFolderChooserForTests(async () => {
      throw new Error('dialog unavailable')
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('dialog unavailable')
  })

  it('opens the macOS Finder picker through AppleScript', async () => {
    const calls: Array<{ file: string; args: string[] }> = []
    setNativeFolderDialogRuntimeForTests({
      platform: 'darwin',
      execFile: async (file, args) => {
        calls.push({ file, args })
        return { stdout: '/Users/example/Project\n', stderr: '', code: 0 }
      },
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder?title=Pick%20\"Project\"')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: '/Users/example/Project' })
    expect(calls[0]?.file).toBe('osascript')
    expect(calls[0]?.args[1]).toContain('Pick \\"Project\\"')
  })

  it('treats macOS picker cancellation as an empty selection', async () => {
    setNativeFolderDialogRuntimeForTests({
      platform: 'darwin',
      execFile: async () => ({ stdout: '', stderr: 'User cancelled.', code: 1 }),
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: null })
  })

  it('reports macOS picker command failures', async () => {
    setNativeFolderDialogRuntimeForTests({
      platform: 'darwin',
      execFile: async () => ({ stdout: '', stderr: 'osascript failed', code: 1 }),
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('osascript failed')
  })

  it('opens the Windows folder picker through PowerShell', async () => {
    const calls: Array<{ file: string; args: string[] }> = []
    setNativeFolderDialogRuntimeForTests({
      platform: 'win32',
      execFile: async (file, args) => {
        calls.push({ file, args })
        return { stdout: 'C:\\Users\\Example\\Project\r\n', stderr: '', code: 0 }
      },
    })
    const url = new URL("http://localhost/api/filesystem/choose-folder?title=Owner's%20folder")

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    expect(calls[0]?.file).toBe('powershell')
    expect(calls[0]?.args.join(' ')).toContain("Owner''s folder")
  })

  it('treats Windows picker cancellation as an empty selection', async () => {
    setNativeFolderDialogRuntimeForTests({
      platform: 'win32',
      execFile: async () => ({ stdout: '', stderr: 'Canceled by user', code: 1 }),
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: null })
  })

  it('reports Windows picker command failures', async () => {
    setNativeFolderDialogRuntimeForTests({
      platform: 'win32',
      execFile: async () => ({ stdout: '', stderr: 'powershell failed', code: 1 }),
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('powershell failed')
  })

  it('opens Linux folder picker through zenity', async () => {
    const calls: Array<{ file: string; args: string[] }> = []
    setNativeFolderDialogRuntimeForTests({
      platform: 'linux',
      execFile: async (file, args) => {
        calls.push({ file, args })
        return { stdout: '/home/example/project\n', stderr: '', code: 0 }
      },
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder?title=Pick%20folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: '/home/example/project' })
    expect(calls[0]).toEqual({
      file: 'zenity',
      args: ['--file-selection', '--directory', '--title', 'Pick folder'],
    })
  })

  it('treats Linux picker cancellation as an empty selection', async () => {
    setNativeFolderDialogRuntimeForTests({
      platform: 'linux',
      execFile: async () => ({ stdout: '', stderr: 'user cancelled', code: 1 }),
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ path: null })
  })

  it('reports unavailable Linux native picker commands', async () => {
    setNativeFolderDialogRuntimeForTests({
      platform: 'linux',
      execFile: async () => ({ stdout: '', stderr: '', code: 127, error: 'zenity missing' }),
    })
    const url = new URL('http://localhost/api/filesystem/choose-folder')

    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(500)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('zenity missing')
  })

  it('blocks native folder chooser calls through non-local hosts', async () => {
    setNativeFolderChooserForTests(async () => '/tmp/should-not-open')

    const url = new URL('http://192.168.0.2/api/filesystem/choose-folder')
    const res = await handleFilesystemRoute(
      '/api/filesystem/choose-folder',
      url,
      new Request(url, { method: 'POST' }),
    )

    expect(res.status).toBe(403)
  })
})

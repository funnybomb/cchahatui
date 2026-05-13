import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { SessionStore } from '../session-store.js'

describe('SessionStore', () => {
  let tmpDir: string
  let store: SessionStore
  let originalProjectConfigDir: string | undefined
  let originalConfigDir: string | undefined
  let originalAppData: string | undefined
  let originalXdgConfigHome: string | undefined
  const originalPlatform = process.platform

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-store-'))
    originalProjectConfigDir = process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalAppData = process.env.APPDATA
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME
    delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    delete process.env.CLAUDE_CONFIG_DIR
    delete process.env.APPDATA
    delete process.env.XDG_CONFIG_HOME
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    store = new SessionStore(path.join(tmpDir, 'sessions.json'))
  })

  afterEach(() => {
    if (originalProjectConfigDir === undefined) delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    else process.env.CCHAHATUI_PROJECT_CONFIG_DIR = originalProjectConfigDir

    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir

    if (originalAppData === undefined) delete process.env.APPDATA
    else process.env.APPDATA = originalAppData

    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome

    Object.defineProperty(process, 'platform', { value: originalPlatform })

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns null for unknown chatId', () => {
    expect(store.get('unknown')).toBeNull()
  })

  it('stores and retrieves a session', () => {
    store.set('chat-1', 'uuid-aaa', '/path/to/project')
    const entry = store.get('chat-1')
    expect(entry).not.toBeNull()
    expect(entry!.sessionId).toBe('uuid-aaa')
    expect(entry!.workDir).toBe('/path/to/project')
  })

  it('stores default adapter session mappings under project content config', () => {
    process.env.CCHAHATUI_PROJECT_CONFIG_DIR = tmpDir
    process.env.CLAUDE_CONFIG_DIR = path.join(os.homedir(), '.claude')

    const defaultStore = new SessionStore()
    defaultStore.set('chat-project', 'uuid-project', '/workspace/project')

    expect(fs.existsSync(path.join(tmpDir, 'adapter-sessions.json'))).toBe(true)
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'adapter-sessions.json'), 'utf-8'))
    expect(data['chat-project'].sessionId).toBe('uuid-project')
  })

  it('stores default mappings in the app config dir when shared ~/.claude is inherited', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    process.env.XDG_CONFIG_HOME = tmpDir
    process.env.CLAUDE_CONFIG_DIR = path.join(os.homedir(), '.claude')

    const defaultStore = new SessionStore()
    defaultStore.set('chat-default', 'uuid-default', '/workspace/project')

    const storePath = path.join(tmpDir, 'cchahatui', 'config', 'adapter-sessions.json')
    expect(fs.existsSync(storePath)).toBe(true)
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    expect(data['chat-default'].sessionId).toBe('uuid-default')
  })

  it('uses APPDATA for default Windows adapter session storage', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const appData = path.join(tmpDir, 'AppData', 'Roaming')
    process.env.APPDATA = appData

    const defaultStore = new SessionStore()
    defaultStore.set('chat-windows', 'uuid-windows', '/workspace/project')

    expect(
      fs.existsSync(path.join(appData, 'cchahatui', 'config', 'adapter-sessions.json')),
    ).toBe(true)
  })

  it('overwrites existing entry on set', () => {
    store.set('chat-1', 'uuid-aaa', '/old')
    store.set('chat-1', 'uuid-bbb', '/new')
    expect(store.get('chat-1')!.sessionId).toBe('uuid-bbb')
  })

  it('deletes an entry', () => {
    store.set('chat-1', 'uuid-aaa', '/path')
    store.delete('chat-1')
    expect(store.get('chat-1')).toBeNull()
  })

  it('deletes every chat entry bound to a sessionId', () => {
    store.set('chat-1', 'uuid-shared', '/project-a')
    store.set('chat-2', 'uuid-other', '/project-b')
    store.set('chat-3', 'uuid-shared', '/project-c')

    const removed = store.deleteBySessionId('uuid-shared')

    expect(removed.sort()).toEqual(['chat-1', 'chat-3'])
    expect(store.get('chat-1')).toBeNull()
    expect(store.get('chat-3')).toBeNull()
    expect(store.get('chat-2')!.sessionId).toBe('uuid-other')

    const reloaded = new SessionStore(path.join(tmpDir, 'sessions.json'))
    expect(reloaded.get('chat-1')).toBeNull()
    expect(reloaded.get('chat-3')).toBeNull()
    expect(reloaded.get('chat-2')!.sessionId).toBe('uuid-other')
  })

  it('refreshes from disk before reading so running adapters do not reuse deleted mappings', () => {
    store.set('chat-1', 'uuid-stale', '/project')
    const serverSideStore = new SessionStore(path.join(tmpDir, 'sessions.json'))

    expect(serverSideStore.deleteBySessionId('uuid-stale')).toEqual(['chat-1'])

    expect(store.get('chat-1')).toBeNull()
    expect(store.listAll()).toEqual([])
  })

  it('returns an empty list when deleting an unknown sessionId', () => {
    store.set('chat-1', 'uuid-aaa', '/project')

    expect(store.deleteBySessionId('uuid-missing')).toEqual([])
    expect(store.get('chat-1')!.sessionId).toBe('uuid-aaa')
  })

  it('persists to disk and reloads', () => {
    store.set('chat-1', 'uuid-aaa', '/path')

    const store2 = new SessionStore(path.join(tmpDir, 'sessions.json'))
    expect(store2.get('chat-1')!.sessionId).toBe('uuid-aaa')
  })

  it('handles missing file gracefully', () => {
    const store2 = new SessionStore(path.join(tmpDir, 'nonexistent.json'))
    expect(store2.get('anything')).toBeNull()
  })

  it('lists all entries', () => {
    store.set('chat-1', 'uuid-1', '/a')
    store.set('chat-2', 'uuid-2', '/b')
    const all = store.listAll()
    expect(all).toHaveLength(2)
  })
})

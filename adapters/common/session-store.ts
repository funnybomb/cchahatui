import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

const PROJECT_CONFIG_DIR_ENV = 'CCHAHATUI_PROJECT_CONFIG_DIR'
const APP_NAME = 'cchahatui'
const APP_CONFIG_DIR_NAME = 'config'

export type SessionEntry = {
  sessionId: string
  workDir: string
  updatedAt: number
}

type StoreData = Record<string, SessionEntry>

function getDefaultCchahatuiConfigDir(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME, APP_CONFIG_DIR_NAME)
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME, APP_CONFIG_DIR_NAME)
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME, APP_CONFIG_DIR_NAME)
}

function isSharedClaudeConfigDir(configDir: string): boolean {
  return path.normalize(configDir) === path.normalize(path.join(os.homedir(), '.claude'))
}

function getProjectContentConfigDir(): string {
  const configured = process.env[PROJECT_CONFIG_DIR_ENV] || process.env.CLAUDE_CONFIG_DIR
  if (configured && !isSharedClaudeConfigDir(configured)) {
    return configured
  }
  return getDefaultCchahatuiConfigDir()
}

function getDefaultPath(): string {
  const configDir = getProjectContentConfigDir()
  return path.join(configDir, 'adapter-sessions.json')
}

export class SessionStore {
  private data: StoreData
  private filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? getDefaultPath()
    this.data = this.load()
  }

  get(chatId: string): SessionEntry | null {
    this.refresh()
    return this.data[chatId] ?? null
  }

  set(chatId: string, sessionId: string, workDir: string): void {
    this.refresh()
    this.data[chatId] = { sessionId, workDir, updatedAt: Date.now() }
    this.save()
  }

  delete(chatId: string): void {
    this.refresh()
    delete this.data[chatId]
    this.save()
  }

  deleteBySessionId(sessionId: string): string[] {
    this.refresh()
    const removed: string[] = []
    for (const [chatId, entry] of Object.entries(this.data)) {
      if (entry.sessionId !== sessionId) continue
      delete this.data[chatId]
      removed.push(chatId)
    }
    if (removed.length > 0) {
      this.save()
    }
    return removed
  }

  listAll(): Array<{ chatId: string } & SessionEntry> {
    this.refresh()
    return Object.entries(this.data).map(([chatId, entry]) => ({ chatId, ...entry }))
  }

  private refresh(): void {
    this.data = this.load()
  }

  private load(): StoreData {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
    } catch {
      return {}
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${this.filePath}.tmp.${Date.now()}`
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n')
    fs.renameSync(tmp, this.filePath)
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'

import { filesystemApi } from './filesystem'
import { getDefaultBaseUrl, setBaseUrl } from './client'

describe('filesystemApi', () => {
  afterEach(() => {
    setBaseUrl(getDefaultBaseUrl())
    vi.restoreAllMocks()
  })

  it('opens the native folder chooser with a long timeout', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ path: '/workspace/project' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    setBaseUrl('http://127.0.0.1:3456')

    await expect(filesystemApi.chooseFolder('Choose project folder')).resolves.toEqual({
      path: '/workspace/project',
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('http://127.0.0.1:3456/api/filesystem/choose-folder?title=Choose+project+folder')
    expect((init as RequestInit).method).toBe('POST')
  })

  it('passes a default path to the native folder chooser', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ path: '/workspace/project' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    setBaseUrl('http://127.0.0.1:3456')

    await expect(filesystemApi.chooseFolder('Choose project folder', '/workspace')).resolves.toEqual({
      path: '/workspace/project',
    })

    const [url] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('http://127.0.0.1:3456/api/filesystem/choose-folder?title=Choose+project+folder&defaultPath=%2Fworkspace')
  })

  it('omits the folder chooser title query when no title is provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ path: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    setBaseUrl('http://127.0.0.1:3456')

    await expect(filesystemApi.chooseFolder()).resolves.toEqual({ path: null })

    const [url] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('http://127.0.0.1:3456/api/filesystem/choose-folder')
  })
})

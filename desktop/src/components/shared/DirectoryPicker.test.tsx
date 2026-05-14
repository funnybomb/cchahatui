import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    getRecentProjects: vi.fn(),
  },
}))

vi.mock('../../api/filesystem', () => ({
  filesystemApi: {
    browse: vi.fn(),
    chooseFolder: vi.fn(),
  },
}))

vi.mock('../../api/projects', () => ({
  projectsApi: {
    addProject: vi.fn().mockResolvedValue(undefined),
  },
}))

const desktopRuntimeMock = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(() => false),
}))
const dialogOpenMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/desktopRuntime', () => desktopRuntimeMock)
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: dialogOpenMock,
}))

import { DirectoryPicker } from './DirectoryPicker'
import { sessionsApi } from '../../api/sessions'
import { filesystemApi } from '../../api/filesystem'
import { projectsApi } from '../../api/projects'

describe('DirectoryPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    desktopRuntimeMock.isTauriRuntime.mockReturnValue(false)
  })

  it('uses the source repository name as the fallback label for desktop worktree paths', () => {
    render(
      <DirectoryPicker
        value="/workspace/checkout/.claude/worktrees/desktop-feature-rail-12345678"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button')).toHaveTextContent('checkout')
    expect(screen.getByRole('button')).not.toHaveTextContent('desktop-feature-rail-12345678')
  })

  it('does not duplicate the branch in the selected project chip', async () => {
    vi.mocked(sessionsApi.getRecentProjects).mockResolvedValue({
      projects: [{
        projectPath: '/workspace/project',
        realPath: '/Users/nanmi/workspace/project',
        projectName: 'project',
        repoName: 'NanmiCoder/OpenCutSkill',
        branch: 'main',
        isGit: true,
        modifiedAt: '2026-05-07T00:00:00.000Z',
        sessionCount: 1,
      }],
    })

    render(
      <DirectoryPicker
        value="/Users/nanmi/workspace/project"
        onChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button'))

    const trigger = await waitFor(() => screen.getAllByRole('button', { name: /NanmiCoder\/OpenCutSkill/ })[0])
    expect(trigger).toHaveTextContent('NanmiCoder/OpenCutSkill')
    expect(trigger).not.toHaveTextContent('main')
    expect(screen.getByText('~/workspace/project')).toBeInTheDocument()
    expect(screen.queryByText('/Users/nanmi/workspace/project')).not.toBeInTheDocument()
  })

  it('supports the flat workbar trigger variant without changing the selected label', () => {
    render(
      <DirectoryPicker
        value="/workspace/project"
        onChange={vi.fn()}
        variant="workbar"
      />,
    )

    const trigger = screen.getByRole('button')
    expect(trigger).toHaveTextContent('project')
    expect(trigger.className).toContain('rounded-[7px]')
    expect(trigger.className).not.toContain('rounded-full')
  })

  it('constrains long workbar project names while keeping the hover path private', () => {
    const longProjectName = 'project-with-a-very-long-directory-name-that-should-not-stretch-the-launch-bar'
    const longPath = `/Users/nanmi/workspace/${longProjectName}`

    render(
      <DirectoryPicker
        value={longPath}
        onChange={vi.fn()}
        variant="workbar"
      />,
    )

    const trigger = screen.getByRole('button')
    const label = screen.getByText(longProjectName)
    const triggerClasses = trigger.className.split(/\s+/)
    expect(trigger).toHaveAttribute('title', `~/workspace/${longProjectName}`)
    expect(trigger.getAttribute('title')).not.toContain('/Users/nanmi')
    expect(triggerClasses).toContain('max-w-full')
    expect(triggerClasses).not.toContain('w-full')
    expect(trigger.parentElement?.className).toContain('max-w-[320px]')
    expect(label.className).toContain('truncate')
  })

  it('can show a Git icon for workbar projects before the recent-project cache is loaded', () => {
    render(
      <DirectoryPicker
        value="/workspace/project"
        onChange={vi.fn()}
        variant="workbar"
        isGitProject
      />,
    )

    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
  })

  it('renders browse entries without nesting interactive buttons', async () => {
    vi.mocked(sessionsApi.getRecentProjects).mockResolvedValue({ projects: [] })
    vi.mocked(filesystemApi.chooseFolder).mockRejectedValue(new Error('native picker unavailable'))
    vi.mocked(filesystemApi.browse).mockResolvedValue({
      currentPath: '/workspace',
      parentPath: '/Users/nanmi',
      entries: [{ name: 'project', path: '/workspace/project', isDirectory: true }],
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<DirectoryPicker value="" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /选择项目|Select a project/ }))
    fireEvent.click(await screen.findByText(/选择其他文件夹|Choose a different folder/))

    expect(await screen.findByRole('button', { name: /project/ })).toBeInTheDocument()
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('validateDOMNesting'))

    errorSpy.mockRestore()
  })

  it('uses the local native folder picker for other projects in browser mode', async () => {
    vi.mocked(sessionsApi.getRecentProjects).mockResolvedValue({ projects: [] })
    vi.mocked(filesystemApi.chooseFolder).mockResolvedValue({ path: '/workspace/native-project' })
    const onChange = vi.fn()

    render(<DirectoryPicker value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /选择项目|Select a project/ }))
    fireEvent.click(await screen.findByText(/选择其他文件夹|Choose a different folder/))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('/workspace/native-project')
    })
    expect(filesystemApi.browse).not.toHaveBeenCalled()
    expect(projectsApi.addProject).toHaveBeenCalledWith('/workspace/native-project')
  })

  it('opens the local native folder picker at the current project path in browser mode', async () => {
    vi.mocked(sessionsApi.getRecentProjects).mockResolvedValue({ projects: [] })
    vi.mocked(filesystemApi.chooseFolder).mockResolvedValue({ path: '/workspace/next-project' })
    const onChange = vi.fn()

    render(<DirectoryPicker value="/workspace/current-project" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /current-project/ }))
    fireEvent.click(await screen.findByText(/选择其他文件夹|Choose a different folder/))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('/workspace/next-project')
    })
    expect(filesystemApi.chooseFolder).toHaveBeenCalledWith(expect.any(String), '/workspace/current-project')
  })

  it('uses the Tauri native folder dialog inside the desktop app', async () => {
    desktopRuntimeMock.isTauriRuntime.mockReturnValue(true)
    dialogOpenMock.mockResolvedValue('/workspace/tauri-project')
    vi.mocked(sessionsApi.getRecentProjects).mockResolvedValue({ projects: [] })
    const onChange = vi.fn()

    render(<DirectoryPicker value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /选择项目|Select a project/ }))
    fireEvent.click(await screen.findByText(/选择其他文件夹|Choose a different folder/))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('/workspace/tauri-project')
    })
    expect(dialogOpenMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: expect.any(String),
    })
    expect(filesystemApi.chooseFolder).not.toHaveBeenCalled()
  })

  it('opens the Tauri folder dialog at the current project path inside the desktop app', async () => {
    desktopRuntimeMock.isTauriRuntime.mockReturnValue(true)
    dialogOpenMock.mockResolvedValue('/workspace/tauri-next')
    vi.mocked(sessionsApi.getRecentProjects).mockResolvedValue({ projects: [] })
    const onChange = vi.fn()

    render(<DirectoryPicker value="/workspace/current-project" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /current-project/ }))
    fireEvent.click(await screen.findByText(/选择其他文件夹|Choose a different folder/))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('/workspace/tauri-next')
    })
    expect(dialogOpenMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: expect.any(String),
      defaultPath: '/workspace/current-project',
    })
  })
})

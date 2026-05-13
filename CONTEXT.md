# Context

## Glossary

- **Project**: A filesystem work directory used to scope sessions, recent-project metadata, and project memory. A project is identified by the session `workDir`/`projectPath`; it is not a separate workspace database entity.
- **Saved project**: A user-pinned project path stored in cchahatui managed config so it can appear even before it has sessions. Removing a saved project only removes it from the project list; it never deletes files or transcripts.
- **Session**: One chat conversation backed by a Claude-compatible transcript and optional working directory. Sessions are listed flat by the server and grouped by project in the desktop UI.
- **Project memory**: Durable per-project notes that are injected as private model context for messages sent from that project. User-visible message text stays unchanged.

# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Project: Sea Trader Remake (רימייק "סוחר הים")

Modern remake of the Hebrew DOS game "סוחר הים" (Turbo Pascal, 1980s).
Game logic must be a faithful 1:1 reconstruction of the original engine
(source of truth: the reverse-engineering docs in
`רימיקס לסוחר הים/מנגנון הפעלה והגרלת סיכויים ואירועים/`), wrapped in a
modern mouse-driven pixel-art UI. Hebrew (RTL) UI. Offline Windows desktop.
See `תיעוד התקדמות.md` for full project state and decisions log.

## Technology Stack

- **Engine**: Godot 4.6 (pinned — see `docs/engine-reference/godot/VERSION.md`)
- **Language**: GDScript (static typing enforced)
- **Version Control**: Git with trunk-based development
- **Build System**: Godot export templates — Windows Desktop (single EXE + PCK)
- **Asset Pipeline**: Godot import pipeline; pixel-art textures (nearest filtering)

> **Note**: Engine-specialist agents exist for Godot, Unity, and Unreal with
> dedicated sub-specialists. This project uses the **Godot** set.

## Project Structure

@.claude/docs/directory-structure.md

## Engine Version Reference

@docs/engine-reference/godot/VERSION.md

## Technical Preferences

@.claude/docs/technical-preferences.md

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

@.claude/docs/context-management.md

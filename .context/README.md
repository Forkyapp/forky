# AI Context Directory

This directory contains context files that are automatically loaded into AI model prompts to provide project-specific guidelines, coding patterns, and best practices.

## Directory Structure

```
.context/
├── models/              # Model-specific guidelines
│   ├── claude.md       # Claude coding patterns & preferences
│   ├── gemini.md       # Gemini documentation guidelines
│   └── codex.md        # Codex review checklist
│
├── projects/           # Project-specific context (per target repo)
│   ├── {project-name}.md
│   └── ...
│
└── shared/             # Shared guidelines across all models
    ├── architecture.md
    ├── testing.md
    └── security.md
```

## How It Works

When an AI agent is launched for a task:

1. **Global context** is loaded from `.context/models/{agent-name}.md`
2. **Project-specific context** is loaded from `.context/projects/{project-name}.md`
3. **Shared guidelines** are loaded from `.context/shared/*.md`
4. All context is prepended to the task prompt

## File Format

Context files use Markdown format with clear sections:

```markdown
# {Title}

## Coding Patterns

{Patterns specific to this project/model}

## Examples

{Code examples to follow}

## Don'ts

{What to avoid}
```

## Usage

### For Claude (Implementation):
- **Purpose:** Define coding standards, TypeScript patterns, error handling
- **When:** Before implementing features
- **File:** `.context/models/claude.md`

### For Gemini (Documentation):
- **Purpose:** Technical writing style, documentation structure
- **When:** Before writing feature specifications
- **File:** `.context/models/gemini.md`

### For Codex (Review):
- **Purpose:** Review checklist, code quality standards
- **When:** Before reviewing code
- **File:** `.context/models/codex.md`

## Project-Specific Context

Each target repository can have its own context file:

```bash
.context/projects/
├── kings-international.md    # Kings Int specific patterns
├── personal-website.md        # Personal site guidelines
└── forky.md                   # Forky development patterns
```

These contain:
- Architecture overview
- Project-specific conventions
- Dependencies and their usage
- File structure explanations
- Module relationships

## Creating New Context

1. **For a new model:**
   ```bash
   touch .context/models/{model-name}.md
   # Add guidelines and examples
   ```

2. **For a new project:**
   ```bash
   touch .context/projects/{project-name}.md
   # Add project-specific context
   ```

3. **Shared guidelines:**
   ```bash
   touch .context/shared/{topic}.md
   # Add guidelines applicable to all
   ```

## Best Practices

### Keep Context Focused
- ✅ Specific coding patterns
- ✅ Real examples from codebase
- ✅ Common mistakes to avoid
- ❌ Generic programming advice
- ❌ Language basics
- ❌ Obvious information

### Keep It Updated
- Update when patterns change
- Add new patterns as they emerge
- Remove outdated conventions
- Include recent refactorings

### Make It Actionable
- Provide concrete examples
- Show before/after code
- Link to relevant files
- Include checklist items

## Example Workflow

**Task:** "Add user authentication"

**Context Loaded:**
1. `.context/models/claude.md` → Coding patterns
2. `.context/projects/kings-international.md` → Project architecture
3. `.context/shared/security.md` → Security guidelines

**Result:** Claude implements with:
- Project's coding style
- Existing architecture patterns
- Security best practices

## Maintenance

### When to Update:
- After major refactorings
- When adding new patterns
- After architecture changes
- When dependencies change

### What to Include:
- Recently solved problems
- Common review feedback
- Project conventions
- Integration patterns

### What NOT to Include:
- Personal preferences
- Temporary hacks
- Experimental code
- Outdated patterns

## Integration

Context loading happens automatically in:
- `lib/claude.ts` - Loads claude.md before implementation
- `lib/gemini.ts` - Loads gemini.md before analysis
- `lib/codex.ts` - Loads codex.md before review

See `lib/context-loader.ts` for implementation.

# AI Context Directory

This directory contains context files that are automatically loaded into AI model prompts to provide project-specific guidelines, coding patterns, and best practices.

## Directory Structure

```
.context/
├── models/              # Model-specific guidelines
│   ├── claude.md       # Claude coding patterns & preferences
│   ├── gemini.md       # Gemini documentation guidelines
│   ├── codex.md        # Codex review checklist
│   └── qwen.md         # Qwen test writing guidelines
│
├── examples/           # Code examples & templates (CACHED & ALWAYS LOADED)
│   ├── code/          # Code implementation examples
│   │   └── typescript-patterns.md
│   ├── tests/         # Test writing examples
│   │   └── unit-test-example.md
│   └── patterns/      # Design patterns & best practices
│       └── error-handling.md
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

1. **Model-specific guidelines** are loaded from `.context/models/{agent-name}.md`
2. **Shared guidelines** are loaded from `.context/shared/*.md`
3. **Code examples & templates** are loaded from `.context/examples/**/*.md` **(CACHED & ALWAYS INCLUDED)**
4. **Project-specific context** is loaded from `.context/projects/{project-name}.md`
5. All context is intelligently embedded and cached for performance
6. Relevant chunks are selected based on task description using semantic search

### Caching System

The smart context loader:
- **Caches** all examples and templates for fast retrieval
- **Embeds** content using TF-IDF-like vectors
- **Ranks** by relevance using cosine similarity
- **Refreshes** cache when files are modified (via MD5 hash check)
- **Selects** most relevant chunks within token limits

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

### For Qwen (Testing):
- **Purpose:** Test writing guidelines, testing patterns
- **When:** Before writing unit tests
- **File:** `.context/models/qwen.md`

## Examples Directory

The `.context/examples/` directory contains **real, working code examples** that AI agents reference when writing code or tests:

### `/examples/code/`
- TypeScript patterns
- Service implementations
- Repository patterns
- Utility functions
- **Format:** Markdown with code blocks or `.ts` files

### `/examples/tests/`
- Unit test examples
- Integration test patterns
- Mocking strategies
- Test organization
- **Format:** Markdown with test examples

### `/examples/patterns/`
- Error handling patterns
- Async patterns
- Design patterns
- Best practices
- **Format:** Markdown with explanations + code

**These examples are ALWAYS loaded and cached** - AI agents will automatically reference them when writing similar code.

## Project-Specific Context

Each target repository can have its own context file:

```bash
.context/projects/
├── kings-international.md    # Kings Int specific patterns
├── personal-website.md        # Personal site guidelines
└── timmy.md                   # Timmy development patterns
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

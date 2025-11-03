# Documentation & Features Folder Structure

## Overview

All feature specifications created by Gemini are now organized in the `docs/features/` directory for better documentation management.

---

## New Folder Structure

```
project-root/
├── docs/
│   └── features/
│       ├── {taskId-1}/
│       │   ├── feature-spec.md      # Gemini's detailed specification
│       │   └── prompt.txt           # Original Gemini prompt
│       ├── {taskId-2}/
│       │   ├── feature-spec.md
│       │   └── prompt.txt
│       └── ...
├── lib/
├── node_modules/
└── ...
```

---

## Changes Made

### 1. Configuration Update

**File:** `lib/config.js`

**Before:**
```javascript
featuresDir: path.join(__dirname, '..', 'features')
```

**After:**
```javascript
featuresDir: path.join(__dirname, '..', 'docs', 'features')
```

**Path:** `docs/features/` (organized under documentation)

---

### 2. Gemini Integration

**File:** `lib/gemini.js`

Gemini now:
- Creates folders in `docs/features/{taskId}/`
- Returns `featureDir` path in analysis result
- Generates `feature-spec.md` with:
  - Feature overview
  - **Files to Modify** section (critical!)
  - Technical approach
  - Implementation steps
  - Testing strategy
  - Acceptance criteria

**Return value:**
```javascript
{
  success: true,
  featureSpecFile: 'docs/features/task-123/feature-spec.md',
  featureDir: 'docs/features/task-123',
  content: '...'  // Full markdown content
}
```

---

### 3. Claude Integration

**File:** `lib/claude.js`

Claude now receives feature folder path and:
- **Reads feature spec first** (step 0)
- Gets file paths to modify from spec
- Follows implementation guidance
- Has full context before coding

**Updated prompt includes:**
```markdown
**FEATURE DOCUMENTATION:**
The detailed feature specification is located at:
`docs/features/task-123/feature-spec.md`

You can read this file to understand the implementation requirements,
files to modify, and acceptance criteria.

**Required Steps:**
0. Read the feature specification:
   Read the file: docs/features/task-123/feature-spec.md
   This contains detailed requirements, files to modify, and implementation guidance.

1. Navigate to repository...
2. Update main branch...
3. Create new branch...
```

---

### 4. Codex Integration

**File:** `lib/codex.js`

Codex receives same feature folder information for:
- Alternative implementation (if used instead of Claude)
- Code review process
- Understanding context

---

## Workflow

### Complete Feature Development Flow

```
1. ClickUp Task Created
   ↓
2. Gemini Analysis
   - Creates: docs/features/task-123/
   - Generates: docs/features/task-123/feature-spec.md
   - Returns: featureDir path
   ↓
3. Claude Implementation
   - Receives: analysis with featureDir
   - Step 0: Reads docs/features/task-123/feature-spec.md
   - Step 1-8: Implements based on spec
   - Creates: PR
   ↓
4. Codex Review (optional)
   - Has access to feature spec
   - Adds TODO comments
   ↓
5. Claude Fixes
   - Addresses TODOs
   - Updates PR
   ↓
6. Complete!
```

---

## Example Feature Spec

**Location:** `docs/features/task-123/feature-spec.md`

```markdown
# Feature Specification - Add User Authentication

## Feature Overview
Implement JWT-based authentication for the API...

## Files to Modify
- `lib/auth.js` - Create authentication module
- `lib/middleware/jwt.js` - JWT verification middleware
- `routes/auth.js` - Login/logout routes
- `tests/auth.test.js` - Unit tests
- `tests/integration/login.test.js` - Integration tests

## Technical Approach
- Use jsonwebtoken library
- HTTP-only cookies
- Refresh token rotation
- Rate limiting

## Implementation Steps
1. Install dependencies (jsonwebtoken, bcrypt)
2. Create `lib/auth.js` with login/signup logic
3. Implement JWT middleware in `lib/middleware/jwt.js`
4. Add routes in `routes/auth.js`
5. Protect existing routes with JWT middleware
6. Write tests

## Testing Strategy
- Unit tests for authentication logic
- Integration tests for login flow
- Test token expiration
- Test invalid credentials

## Acceptance Criteria
- [ ] Users can register
- [ ] Users can login
- [ ] Protected routes verify JWT
- [ ] Tokens expire after 1 hour
- [ ] All tests pass
```

---

## Benefits

### 1. **Better Organization**
- All feature docs in one place
- Clear separation from code
- Easy to browse past features
- Documentation-first approach

### 2. **Version Control**
- Feature specs tracked in git
- Historical record of requirements
- Can reference past implementations
- Audit trail

### 3. **AI Context**
- Claude knows exactly where to look
- Consistent documentation location
- No searching needed
- Clear file paths

### 4. **Developer Reference**
- Humans can read specs too
- Understand implementation decisions
- Review requirements
- Onboarding resource

### 5. **Compliance & Tracking**
- Document what was requested
- Track scope creep
- Requirements traceability
- Project documentation

---

## File Naming Convention

### Task Folder
```
docs/features/{taskId}/
```
Where `{taskId}` is the ClickUp task ID (e.g., `task-123`, `abc456xyz`)

### Files Within
```
docs/features/{taskId}/
├── feature-spec.md       # Main specification
├── prompt.txt            # Original prompt sent to Gemini
└── (future: screenshots, diagrams, etc.)
```

---

## API Reference

### Gemini Returns
```javascript
const analysis = await gemini.analyzeTask(task);

console.log(analysis.featureDir);
// Output: 'docs/features/task-123'

console.log(analysis.featureSpecFile);
// Output: 'docs/features/task-123/feature-spec.md'
```

### Claude Receives
```javascript
await claude.launchClaude(task, { analysis });

// Claude gets:
// - analysis.content (embedded in prompt)
// - analysis.featureDir (tells Claude where to read spec)
```

### Codex Receives
```javascript
await codex.launchCodex(task, { analysis });

// Codex gets same information as Claude
```

---

## Directory Structure Benefits

### Old Structure
```
project-root/
├── features/
│   └── task-123/
│       └── feature-spec.md
```
**Issues:**
- Mixed with project root
- No clear organization
- Not obviously documentation

### New Structure
```
project-root/
├── docs/
│   └── features/
│       └── task-123/
│           └── feature-spec.md
```
**Benefits:**
- ✅ Clear documentation folder
- ✅ Professional organization
- ✅ Scalable structure
- ✅ Standard convention
- ✅ Easy to .gitignore if needed
- ✅ Separates docs from code

---

## Future Enhancements

### 1. Additional Documentation
```
docs/
├── features/
│   └── task-123/
│       ├── feature-spec.md
│       ├── implementation-notes.md  # NEW
│       ├── api-changes.md           # NEW
│       └── screenshots/             # NEW
│           ├── before.png
│           └── after.png
```

### 2. Index Generation
```javascript
// Auto-generate docs/features/README.md
// List all features with links
```

### 3. Search Functionality
```bash
# Search across all feature specs
grep -r "authentication" docs/features/
```

### 4. HTML Documentation
```bash
# Convert to static site
npx markdown-to-html docs/features/**/*.md
```

### 5. Linking Features
```markdown
## Related Features
- See also: [task-100](../task-100/feature-spec.md)
- Depends on: [task-50](../task-50/feature-spec.md)
```

---

## Git Configuration

### Recommended .gitignore

**Option 1: Track all feature specs** (Recommended)
```gitignore
# Don't add docs/features/ to .gitignore
# Keep feature specs in version control
```

**Option 2: Ignore generated specs**
```gitignore
# Ignore generated feature specs
docs/features/*/feature-spec.md
docs/features/*/prompt.txt

# But keep the folders
!docs/features/*/.gitkeep
```

**Option 3: Ignore everything**
```gitignore
# Ignore all feature documentation
docs/features/
```

**Recommendation:** Track everything for documentation purposes.

---

## Migration Guide

### From Old Location

If you have existing features in `features/`:

```bash
# Create new directory
mkdir -p docs/features

# Move existing features
mv features/* docs/features/

# Remove old directory
rmdir features
```

### Manual Test

1. Create a test task in ClickUp
2. Watch Gemini create: `docs/features/{taskId}/`
3. Verify Claude reads from that location
4. Check PR includes correct implementation

---

## Troubleshooting

### Issue: Claude can't find feature spec

**Check:**
1. Does `docs/features/{taskId}/feature-spec.md` exist?
2. Is the path correct in Claude's prompt?
3. Check orchestrator passes `analysis.featureDir`

**Debug:**
```javascript
// In orchestrator.js
console.log('Analysis:', analysis);
console.log('Feature dir:', analysis.featureDir);
```

### Issue: Folder not created

**Check:**
1. Gemini ran successfully
2. Config points to `docs/features/`
3. Permissions to create folders

**Verify:**
```bash
ls -la docs/features/
```

---

## Summary

✅ **Feature specifications now in `docs/features/`**

**What changed:**
- Configuration points to `docs/features/`
- Gemini creates folders there
- Claude/Codex receive folder path
- AIs read spec before implementing

**Benefits:**
- Better organization
- Clear documentation
- Version control
- AI knows where to look
- Professional structure

**Result:**
- Features are well-documented
- Implementation follows spec
- Easier to review and maintain
- Clear audit trail

---

**Status:** ✅ **Ready to use!**

All feature documentation will now be organized in `docs/features/{taskId}/`

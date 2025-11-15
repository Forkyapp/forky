# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Timmy seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do the following:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Report the vulnerability by opening a GitHub Security Advisory at:
   - Navigate to the repository's Security tab
   - Click "Report a vulnerability"
   - Fill out the form with details

### What to include in your report:

- Type of vulnerability (e.g., code injection, credential exposure, etc.)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### What to expect:

- We will acknowledge your report within 48 hours
- We will provide a more detailed response within 7 days
- We will work with you to understand and validate the issue
- We will keep you informed of our progress
- Once the vulnerability is fixed, we will publicly disclose it (giving you credit if desired)

## Security Best Practices

When using Timmy:

### Environment Variables

- **Never commit `.env` files** to version control
- Store API keys and tokens securely
- Use environment-specific `.env` files (`.env.local`, `.env.production`)
- Rotate API keys regularly

### API Keys and Tokens

Timmy requires several API keys:

- `CLICKUP_API_KEY` - ClickUp API access
- `GITHUB_TOKEN` - GitHub API access (with minimal required permissions)

**Important**:
- Use tokens with minimal required scopes
- For GitHub tokens, only grant repository access needed
- Never share tokens in logs, screenshots, or public forums
- Revoke and regenerate tokens if they may have been exposed

### File Permissions

Runtime files may contain sensitive information:
- `processed-tasks.json`
- `task-queue.json`
- `pr-tracking.json`

These files are automatically added to `.gitignore` but ensure they're not shared publicly.

### Running in Production

- Use process managers (PM2, systemd) instead of nohup for production
- Set up log rotation to prevent disk space issues
- Monitor for unusual API activity
- Keep dependencies up to date: `npm audit` regularly
- Run with minimal system permissions

### Code Review

All code changes undergo review to catch potential security issues:
- Input validation
- API rate limiting
- Error handling that doesn't expose sensitive information
- Secure defaults

## Known Security Considerations

### Local Execution

Timmy runs locally on your machine and:
- Has access to your filesystem (limited to configured repository)
- Makes API calls on your behalf
- Launches processes (Claude Code sessions)

### API Access

The bot requires API access to:
- ClickUp (read tasks, update statuses)
- GitHub (create branches, push code, create PRs)

Ensure API keys are restricted to only the necessary permissions.

### Third-Party Dependencies

We regularly audit our dependencies for known vulnerabilities:

```bash
npm audit
```

Run this command regularly to check for security updates.

## Security Updates

Security updates will be released as patch versions and announced via:
- GitHub Security Advisories
- Release notes
- Repository README

Subscribe to repository notifications to stay informed.

## Questions?

If you have questions about security that don't relate to a vulnerability, please open a regular GitHub issue with the "security" label.

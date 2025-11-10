# Testing Guide

This document describes the testing strategy and how to run tests for the Forky project.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Coverage Requirements](#coverage-requirements)
- [CI/CD Integration](#cicd-integration)

## Testing Strategy

Our testing approach includes:

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test interactions between components
3. **Coverage Requirements**: Maintain minimum coverage thresholds
4. **Cross-Platform Testing**: Tests run on Linux, macOS, and Windows
5. **Multiple Node Versions**: Tests run on Node 18.x, 20.x, and 22.x

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm test -- --coverage
```

### Run specific test file

```bash
npm test -- path/to/test.test.ts
```

### Run tests matching a pattern

```bash
npm test -- --testNamePattern="CacheRepository"
```

## Test Structure

```
src/
├── __tests__/
│   └── integration/           # Integration tests
│       ├── task-flow.test.ts
│       └── repository-integration.test.ts
├── core/
│   └── repositories/
│       └── __tests__/         # Unit tests for repositories
│           ├── cache.repository.test.ts
│           └── queue.repository.test.ts
├── shared/
│   ├── errors/
│   │   └── __tests__/         # Unit tests for errors
│   │       └── errors.test.ts
│   └── utils/
│       └── __tests__/         # Unit tests for utilities
│           ├── retry.util.test.ts
│           └── validation.util.test.ts
├── infrastructure/
│   └── storage/
│       └── __tests__/         # Unit tests for storage
│           └── json-storage.test.ts
└── test-setup.ts              # Test utilities and helpers
```

## Writing Tests

### Test File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.test.ts` in `__tests__/integration/`
- Place tests in `__tests__` directory next to the code being tested

### Test Structure

```typescript
import { ComponentToTest } from '../component';
import { createTempDir, cleanupTempDir } from '../../test-setup';

describe('ComponentToTest', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('test-prefix');
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  describe('methodName', () => {
    it('should do something when condition', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Test Helpers

Use the test utilities from `test-setup.ts`:

```typescript
import {
  createTempDir,
  cleanupTempDir,
  createMockClickUpTask,
  createMockGitHubIssue,
  createMockConfig,
  wait,
  MockLogger,
} from './test-setup';
```

### Best Practices

1. **Arrange-Act-Assert Pattern**: Structure tests clearly
2. **Descriptive Names**: Use clear, descriptive test names
3. **Test One Thing**: Each test should verify one behavior
4. **Clean Up**: Always clean up resources (temp files, etc.)
5. **Mock External Dependencies**: Don't make real API calls
6. **Avoid Test Interdependence**: Tests should be independent

## Coverage Requirements

### Minimum Coverage Thresholds

- **Statements**: 70%
- **Branches**: 60%
- **Functions**: 70%
- **Lines**: 70%

These thresholds are enforced in:
- `package.json` (Jest configuration)
- CI/CD pipeline (`.github/workflows/ci.yml`)

### Viewing Coverage

After running tests with coverage:

```bash
npm test -- --coverage
```

View detailed HTML report:

```bash
open coverage/lcov-report/index.html
```

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Text**: Console output
- **Text Summary**: Brief console summary
- **LCOV**: For tools like Codecov
- **JSON Summary**: For CI/CD threshold checks
- **HTML**: Detailed browsable report

## CI/CD Integration

### Automated Testing

Tests run automatically on:
- Every push to `main` branch
- Every pull request
- Manual workflow dispatch

### CI/CD Pipeline Jobs

1. **Quick Validation** (5 min)
   - Type checking
   - Linting
   - Package integrity

2. **Comprehensive Testing** (15 min)
   - Tests on Node 18.x, 20.x, 22.x
   - Tests on Linux, macOS, Windows
   - Coverage threshold enforcement

3. **Build Verification** (10 min)
   - Build on all platforms
   - Artifact verification
   - Size tracking

4. **Security Audit** (10 min)
   - Dependency vulnerability scanning
   - Outdated dependency check
   - Dependency tree analysis

5. **PR Checks** (10 min)
   - Commit message format
   - TODO comment detection
   - Bundle size impact

6. **Quality Gate**
   - All checks must pass
   - Final status report

### Coverage Upload

Coverage reports are uploaded to Codecov for:
- Historical tracking
- PR comments
- Coverage badges

## Debugging Tests

### Run tests with debugging

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Continuous Improvement

We continuously improve our test suite by:

1. **Monitoring Coverage**: Track coverage trends over time
2. **Adding Edge Cases**: Test boundary conditions and error scenarios
3. **Refactoring Tests**: Keep tests maintainable and clear
4. **Performance**: Optimize slow tests
5. **Flakiness**: Eliminate non-deterministic tests

## Getting Help

If you have questions about testing:

1. Review existing tests for examples
2. Check this guide for best practices
3. Ask in pull request reviews
4. Open an issue for discussion

## Contributing

When contributing:

1. Write tests for new features
2. Update tests for bug fixes
3. Maintain or improve coverage
4. Follow testing best practices
5. Document complex test scenarios

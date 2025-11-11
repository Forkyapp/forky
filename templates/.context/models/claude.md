# Claude Implementation Guidelines

## Coding Standards

- Always use TypeScript strict mode
- Never use `any` type
- Use repository pattern for file I/O
- Follow existing architecture patterns

## Example Patterns

```typescript
// Error handling
try {
  const result = await operation();
} catch (error) {
  throw new CustomError('Operation failed', error as Error);
}

// Repository usage
const tasks = await taskRepository.load();
await taskRepository.save(updatedTasks);
```

## Project Structure

Follow the existing structure in `src/` and `lib/` directories.

## Recent Changes

- Data files moved to `data/` directory
- Using workspace system for projects
- Repository pattern for all storage

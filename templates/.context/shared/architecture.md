# Project Architecture

## Directory Structure

```
src/
├── types/          # Type definitions
├── shared/         # Shared utilities
├── core/           # Business logic
└── infrastructure/ # External APIs

lib/
├── storage/        # Data access
├── types/          # Type definitions
└── {module}.ts     # Feature modules
```

## Key Patterns

- Repository pattern for data
- Custom error classes
- Type-safe interfaces
- Async/await for all I/O

## Data Flow

1. API Request → Client
2. Client → Repository
3. Repository → Storage
4. Storage → File System

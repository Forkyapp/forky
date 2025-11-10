# Source Code Architecture

This directory contains the refactored codebase with improved architecture, type safety, and scalability.

## Directory Structure

```
src/
├── types/              # Centralized type definitions
│   ├── clickup.ts      # ClickUp domain types
│   ├── github.ts       # GitHub domain types
│   ├── config.ts       # Configuration types
│   ├── ai.ts           # AI service types
│   ├── storage.ts      # Storage/state management types
│   ├── orchestrator.ts # Orchestrator types
│   ├── common.ts       # Shared/common types
│   └── index.ts        # Type exports
│
├── shared/             # Shared utilities and helpers
│   ├── errors/         # Custom error classes
│   │   ├── base.error.ts
│   │   ├── api.error.ts
│   │   ├── validation.error.ts
│   │   ├── ai.error.ts
│   │   ├── storage.error.ts
│   │   ├── repository.error.ts
│   │   └── index.ts
│   │
│   ├── utils/          # Utility functions
│   │   ├── retry.util.ts      # Retry logic with backoff
│   │   ├── logger.util.ts     # Structured logging
│   │   ├── validation.util.ts # Data validation
│   │   └── index.ts
│   │
│   └── constants/      # Application constants
│       └── index.ts
│
├── core/               # Core business logic
│   ├── repositories/   # Data access layer
│   │   ├── cache.repository.ts         # Task cache
│   │   ├── queue.repository.ts         # Task queue
│   │   ├── pipeline.repository.ts      # Pipeline state
│   │   ├── tracking.repository.ts      # PR/review tracking
│   │   ├── config.repository.ts        # Config management
│   │   └── index.ts
│   │
│   ├── services/       # Service layer (to be implemented)
│   │   └── (future service implementations)
│   │
│   └── models/         # Domain models (to be implemented)
│       └── (future model implementations)
│
├── infrastructure/     # External integrations
│   ├── api/            # API clients
│   │   ├── base.client.ts      # Base API client with retry
│   │   ├── clickup.client.ts   # ClickUp API wrapper
│   │   ├── github.client.ts    # GitHub API wrapper
│   │   └── index.ts
│   │
│   ├── cli/            # CLI tool wrappers (to be implemented)
│   │   └── (future CLI wrappers)
│   │
│   ├── storage/        # Storage implementations
│   │   └── json-storage.ts     # JSON file storage
│   │
│   └── git/            # Git operations (to be implemented)
│       └── (future git wrappers)
│
├── config/             # Configuration management (to be implemented)
│   └── (future config implementations)
│
└── ui/                 # User interface (to be implemented)
    └── (future UI implementations)
```

## Architecture Principles

### 1. **Layered Architecture**
- **Presentation Layer** (UI): Terminal output and formatting
- **Service Layer**: Business logic and orchestration
- **Repository Layer**: Data access abstraction
- **Infrastructure Layer**: External dependencies (APIs, CLIs, file system)

### 2. **Type Safety**
- Centralized type definitions in `src/types/`
- Readonly properties for immutability
- Strict TypeScript compilation
- No `any` types (well-managed)

### 3. **Error Handling**
- Custom error classes with proper inheritance
- Error codes and categories
- Structured error context
- Operational vs non-operational errors

### 4. **Dependency Injection**
- Services receive dependencies via constructor
- Easy testing with mock injection
- Loose coupling between modules

### 5. **Single Responsibility**
- Each module has one clear purpose
- Clear separation of concerns
- Easy to maintain and test

## Key Improvements

### Type Safety Enhancements
- ✅ Centralized type definitions
- ✅ Domain models with runtime validation
- ✅ Stricter interfaces with readonly properties
- ✅ Discriminated unions for state management

### Error Handling
- ✅ Custom error classes hierarchy
- ✅ Error codes and context
- ✅ Better error messages and stack traces
- ✅ Operational error detection

### Code Organization
- ✅ Clear separation between layers
- ✅ Repository pattern for data access
- ✅ API client abstraction
- ✅ Shared utilities and constants

### Scalability
- ✅ Repository pattern enables future database migration
- ✅ API clients can be easily mocked for testing
- ✅ Service layer for business logic isolation
- ✅ Infrastructure abstraction for swappable implementations

## Migration Path

This new architecture coexists with the existing `lib/` directory during migration:

1. ✅ **Phase 1**: New structure created (types, errors, utils, repositories, infrastructure)
2. 🔄 **Phase 2**: Migrate services to use new repositories and infrastructure
3. 🔄 **Phase 3**: Update main entry point to use new service layer
4. 🔄 **Phase 4**: Remove old `lib/` directory after full migration
5. 🔄 **Phase 5**: Add comprehensive tests

## Usage Examples

### Using Type Definitions
```typescript
import { ClickUpTask, PipelineData } from '@/types';
```

### Using Error Classes
```typescript
import { ValidationError, ClickUpAPIError } from '@/shared/errors';

throw new ValidationError('Invalid task ID', [
  { field: 'taskId', message: 'Required' }
]);
```

### Using Repositories
```typescript
import { CacheRepository } from '@/core/repositories';

const cache = new CacheRepository('/path/to/cache.json');
await cache.init();
await cache.add(task);
```

### Using API Clients
```typescript
import { ClickUpClient } from '@/infrastructure/api';

const client = new ClickUpClient({ apiKey: 'xxx' });
const task = await client.getTask('task-id');
```

## Benefits

1. **Better Maintainability**: Clear structure makes code easy to navigate
2. **Improved Testability**: Dependency injection enables easy mocking
3. **Enhanced Reliability**: Comprehensive error handling and typing
4. **Future-Proof**: Architecture supports database migration and scaling
5. **Developer Experience**: Better IDE support with strict typing

## Next Steps

- [ ] Implement service layer with dependency injection
- [ ] Create CLI wrappers for AI agents
- [ ] Migrate main entry point to use new architecture
- [ ] Add comprehensive unit tests
- [ ] Add integration tests
- [ ] Documentation for each module

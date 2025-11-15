# Context Folder Structure

**Note:** This folder contains confidential project documentation and should NOT be pushed to GitHub.

---

## Folder Organization

```
templates/context/
├── _index.md                          # Master navigation
├── README.md                          # Usage guide
├── CONTEXT_LOADING.md                 # Context loading guide for AI
├── STRUCTURE.md                       # This file
│
├── smart-context-loader.ts            # Runtime doc loader (no build needed)
│
├── scripts/                           # Optional build scripts
│   └── build-context-index.ts         # Generate context-index.json
│
├── project/                           # High-level project info (5 files)
│   ├── _index.md                      # Project section navigation
│   ├── overview.md                    # Business context & product overview
│   ├── tech-stack.md                  # Technologies used
│   ├── architecture.md                # System architecture
│   ├── monorepo-structure.md          # Folder structure & organization
│   └── setup.md                       # Environment setup guide
│
├── patterns/                          # Code patterns & best practices
│   ├── shared/                        # Shared (frontend + backend) (5 files)
│   │   ├── _index.md
│   │   ├── zod-schemas.md             # Zod validation patterns
│   │   ├── dto-types.md               # Data Transfer Objects
│   │   ├── error-handling.md          # Error handling patterns
│   │   ├── type-safety.md             # TypeScript type safety
│   │   └── constants-enums.md         # Constants and enums
│   │
│   ├── frontend/                      # Frontend-specific (8 files)
│   │   ├── _index.md
│   │   ├── react-query-basics.md      # React Query hooks & queries
│   │   ├── cache-management.md        # Cache invalidation & optimistic updates
│   │   ├── auth-hooks.md              # Authentication hooks
│   │   ├── derived-hooks.md           # Derived data hooks
│   │   ├── error-handling.md          # Frontend error handling
│   │   ├── styling-patterns.md        # CSS-in-JS patterns (placeholder)
│   │   ├── translation-patterns.md    # i18next patterns (placeholder)
│   │   └── form-patterns.md           # Form handling (placeholder)
│   │
│   └── backend/                       # Backend-specific (7 files)
│       ├── _index.md
│       ├── repositories.md            # Repository pattern with Prisma
│       ├── services.md                # Service layer patterns
│       ├── controllers.md             # NestJS controller patterns
│       ├── transactions.md            # Transaction handling (placeholder)
│       ├── prisma-patterns.md         # Prisma best practices (placeholder)
│       ├── guards-decorators.md       # Guards & decorators (placeholder)
│       └── authentication.md          # Auth implementation (placeholder)
│
├── guides/                            # Quick reference guides (2 files)
│   ├── _index.md
│   ├── common-commands.md             # Frequently used commands
│   └── path-aliases.md                # Import path aliases
│
├── specs/                             # Feature specifications (4 files)
│   ├── student-profile-modal.md
│   ├── student-merge.md
│   ├── teacher-multi-school.md
│   └── transfer-student-endpoint.md
│
└── testing/                           # Testing documentation
    └── _index.md                      # (content pending)
```


# Migration Plan: Firebase to Supabase

This document outlines the strategy for migrating "Product Canvas" from Firebase/Firestore to Supabase (PostgreSQL).

## Database Schema (Relational)

We will use PostgreSQL with a focus on maintaining field names from `types.ts` for backward compatibility during refactoring.

### 1. Table: `users`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid (PK) | Linked to auth.users |
| `name` | text | Full Name |
| `email` | text | |
| `isAdmin` | boolean | |
| `gitlabToken` | text | Nullable |

### 2. Table: `teams`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid (PK) | |
| `name` | text | |
| `description` | text | |
| `leaderId` | uuid (FK) | Reference users.id |
| `repositories` | text[] | |
| `gitlabProjectId` | text | |

*Note: A many-to-many table `team_members` (teamId, userId) will handle memberIds.*

### 3. Table: `product_backlogs`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid (PK) | |
| `title` | text | |
| `description` | text | |
| `createdAt` | bigint | Unix Timestamp |
| `displayId` | text | e.g., PB-001 |
| `role` | text | |
| `priority` | text | |
| `panel` | text | Admin/Customer |

### 4. Table: `user_stories`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid (PK) | |
| `backlogId` | uuid (FK) | |
| `title` | text | |
| `description` | text | |
| `priority` | text | |
| `points` | integer | |
| `role` | text | |
| `displayId` | text | |
| `panel` | text | |
| `createdAt` | bigint | |

### 5. Table: `milestones`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid (PK) | |
| `title` | text | |
| `description` | text | |
| `startDate` | text | ISO Date String |
| `endDate` | text | ISO Date String |
| `status` | text | |

### 6. Table: `tasks`
| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | uuid (PK) | |
| `title` | text | |
| `description` | text | Markdown |
| `status` | text | |
| `userStoryId` | uuid (FK) | |
| `backlogId` | uuid (FK) | |
| `teamId` | uuid (FK) | |
| `assigneeId` | uuid (FK) | |
| `stack` | text | |
| `panel` | text | |
| `createdAt` | bigint | |
| `startTime` | bigint | |
| `endTime` | bigint | |
| `history` | jsonb | Array of objects |
| `assignmentHistory` | jsonb | Array of objects |
| `comments` | jsonb | Array of objects |
| `subtasks` | jsonb | Array of objects |
| `linkedCommits` | jsonb | Array of objects |
| `createdBy` | jsonb | { userId, userName } |
| `lastEditedBy` | jsonb | { userId, userName, timestamp } |

## Migration Roadmap

1. **Phase 1: Foundation**
   - Initialize Supabase project.
   - Create `lib/supabase.ts` (Infrastructure layer).
   - Implement Auth Repository (migration from Firebase Auth).

2. **Phase 2: Repository Layer**
   - Implement `repositories/` for all entities.
   - Decouple UI from direct database calls.

3. **Phase 3: State Management**
   - Migrate component-level `useEffect` queries to centralized hooks.

4. **Phase 4: Cleanup**
   - Remove all Firebase dependencies and configuration.
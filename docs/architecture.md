# React Architecture: Product Canvas

To ensure scalability and ease the migration to Supabase, we are adopting a **Layered Architecture** based on Clean Architecture principles.

## Core Layers

### 1. Domain Layer (`src/core/`)
- Contains pure logic and types.
- `types/`: Pure TypeScript interfaces defining the business entities.
- This layer has zero dependencies on external libraries.

### 2. Infrastructure Layer (`src/lib/`)
- Contains adapters for external services.
- `supabase.ts`: The configured Supabase client.
- `vcs-bridge.ts`: Client for the Go microservice connection.

### 3. Repository Layer (`src/repositories/`)
- Acts as a mediator between the Domain and Infrastructure.
- Defines methods for data access (CRUD).
- Components never call Supabase directly; they call repositories.
- *Benefit*: Swapping the data source only requires changing this layer.

### 4. Application/Service Layer (`src/services/`)
- Orchestrates complex business logic.
- Coordination between different repositories (e.g., AI analysis combining task data and VCS commits).

### 5. Presentation Layer (`src/components/` & `src/hooks/`)
- **Dumb Components**: Focus on UI rendering.
- **Smart Hooks**: Manage local state and communicate with the Repository layer.
- **Features**: Business-specific UI components (e.g., `TasksView`).

## Visual Flow
`UI Component` -> `Custom Hook` -> `Repository` -> `Infrastructure Adapter` -> `Supabase/API`

## Key Rules
- No direct database calls inside `useEffect`.
- All side effects must be handled in hooks.
- All external data fetching must be abstracted via Repositories.
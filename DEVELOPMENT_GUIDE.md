# Development Guide

## Directory Guidelines

### app/
Next.js App Router structure:
- Use route groups `(frontend)` to organize pages without affecting URLs
- Keep API routes under `app/api/` with versioning (`v1/`, `v2/`)

### src/frontend/
All frontend-specific logic:
- **components/**: Reusable React components
- **hooks/**: Custom React hooks
- **lib/**: Frontend utilities and helpers

### src/backend/
All backend-specific logic:

- **controllers/**: Request validation, orchestration, and response formatting
  - Handle HTTP-specific logic (parsing request, formatting response)
  - Validate input using validators from `shared/validators/`
  - Orchestrate multiple services if needed
  - Handle errors and return appropriate HTTP status codes
  - Keep thin - delegate business logic to services

- **services/**: Business logic and core functionality
  - Pure business logic, independent of HTTP/framework
  - Reusable across different controllers or contexts
  - Call repositories for data access
  - Should be easily unit-testable

- **repositories/**: Database queries and data access
  - Abstract database operations
  - Return domain models

- **models/**: Data models, schemas, and types
  - Domain entities and DTOs

- **middleware/**: Custom Express-like middleware for API routes
  - Authentication, logging, etc.

### src/shared/
Code shared between frontend and backend:
- **types/**: TypeScript interfaces and types
- **validators/**: Validation schemas (e.g., Zod, Yup)
- **utils/**: Common utilities
- **constants/**: Shared constants

### docs/
OpenAPI/Swagger specifications:
- Split by feature for better maintainability
- Organized by version (`v1/`, `v2/`)
- Merged at runtime via `/api/openapi` endpoint

## Naming Conventions

- **Folders**: Use kebab-case
  - Examples: `user-profile/`, `auth-service/`

- **React Components**: Use PascalCase
  - Examples: `UserProfile.tsx`, `AuthForm.tsx`

- **Services/Utilities**: Use camelCase
  - Examples: `authService.ts`, `userController.ts`

- **API Routes**: Prefix with version
  - Examples: `/api/v1/users`, `/api/v1/posts`

## Backend Layered Architecture

This project follows a **Controller-Service-Repository** pattern:

```
app/api/v1/users/route.ts (Next.js Route Handler)
    ↓ NextRequest
src/backend/controllers/user-controller.ts (Controller)
    ↓ Validate & Parse
src/backend/services/user-service.ts (Service)
    ↓ Business Logic
src/backend/repositories/user-repository.ts (Repository)
    ↓ Database Query
Database
```

### Layer Responsibilities

#### Route Handler (`app/api/v1/*/route.ts`)
- Define HTTP methods (GET, POST, PUT, DELETE)
- Extract request data and convert NextRequest to plain objects
- Call controller methods
- Convert controller response to NextResponse
- Keep minimal - just HTTP adapter layer

#### Controller (`src/backend/controllers/`)
- Validate input using shared validators
- Transform request data to service parameters
- Orchestrate one or more services
- Handle business errors and convert to HTTP status codes
- Format response data
- Examples: `user-controller.ts`, `auth-controller.ts`

#### Service (`src/backend/services/`)
- Pure business logic, framework-agnostic
- Reusable across different contexts
- Call repositories for data operations
- Handle business rules and validation
- Throw domain-specific errors
- Examples: `user-service.ts`, `email-service.ts`

#### Repository (`src/backend/repositories/`)
- Abstract data access layer
- Database queries (SQL, ORM, etc.)
- Return domain models
- Examples: `user-repository.ts`, `post-repository.ts`

### Example Flow

```typescript
// app/api/v1/users/route.ts
import { userController } from '@/src/backend/controllers/user-controller';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await userController.createUser(body);
  return NextResponse.json(result);
}

// src/backend/controllers/user-controller.ts
export const userController = {
  async createUser(data: unknown) {
    const validated = userSchema.parse(data); // Validate
    const user = await userService.create(validated); // Business logic
    return { user, message: 'User created' }; // Format response
  }
};

// src/backend/services/user-service.ts
export const userService = {
  async create(data: CreateUserDto) {
    // Business logic: hash password, check duplicates, etc.
    const hashedPassword = await hash(data.password);
    return userRepository.save({ ...data, password: hashedPassword });
  }
};

// src/backend/repositories/user-repository.ts
export const userRepository = {
  async save(user: User) {
    // Database operation
    return db.users.create({ data: user });
  }
};
```

## Design Principles

### Separation of Concerns
Each layer has a single, well-defined responsibility:
- Route Handlers = HTTP adapter
- Controllers = Request/Response handling
- Services = Business logic
- Repositories = Data access

### Dependency Direction
Dependencies should flow downward:
```
Route → Controller → Service → Repository → Database
```
Never import upward (e.g., Service should not import Controller).

### Framework Independence
- Services should be framework-agnostic (no Next.js/Express specific code)
- Makes testing easier and allows framework migration if needed

### Testability
- Each layer can be tested independently
- Mock the layer below for unit tests
- Controllers can be tested without HTTP
- Services can be tested without database

## Error Handling

### Route Handler
Convert to NextResponse:
```typescript
try {
  const result = await controller.method();
  return NextResponse.json(result);
} catch (error) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Controller Layer
Convert domain errors to HTTP status codes:
```typescript
try {
  const user = await userService.getById(id);
  return { user };
} catch (error) {
  if (error instanceof UserNotFoundError) {
    throw new HttpError(404, error.message);
  }
  throw new HttpError(500, 'Internal server error');
}
```

### Service Layer
Throw domain-specific errors:
```typescript
class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User with id ${id} not found`);
    this.name = 'UserNotFoundError';
  }
}
```

## API Versioning

### URL-based Versioning
- Use `/api/v1/`, `/api/v2/` for different API versions
- Keep older versions for backward compatibility
- Organize docs by version: `docs/v1/`, `docs/v2/`

### Breaking Changes
When making breaking changes:
1. Create a new version directory (e.g., `app/api/v2/`)
2. Copy and modify the controller/service as needed
3. Update OpenAPI specs in `docs/v2/`
4. Deprecate old version with sunset date

## OpenAPI Code Generation

This project's OpenAPI specification is designed to work seamlessly with code generators, allowing you to automatically create type-safe API clients for various programming languages.

### What is OpenAPI Generator?

[OpenAPI Generator](https://openapi-generator.tech/) is a tool that generates client libraries, server stubs, API documentation, and configuration from an OpenAPI specification. It's the successor to Swagger Codegen and supports 50+ languages.

### Prerequisites

The OpenAPI spec at `/api/openapi` includes:
- `operationId` for each endpoint (used to generate function names)
- Shared schemas in `components.schemas` (for type reuse)
- Detailed request/response models
- Examples and descriptions

### Installation

#### Global Installation
```bash
npm install -g @openapitools/openapi-generator-cli

# Then use it
openapi-generator-cli generate \
  -i http://localhost:3000/api/openapi \
  -g typescript-fetch \
  -o ./generated/api-client
```

### Generating Clients

#### TypeScript (axios)
```bash
openapi-generator-cli generate \
  -i http://localhost:3000/api/openapi \
  -g typescript-axios \
  -o ./generated/api-client
```

### Using Generated Clients

#### TypeScript Example
```typescript
// Install the generated client
// npm install ./generated/api-client

import { DefaultApi, Configuration } from '@your-org/api-client';

// Create API instance
const config = new Configuration({
  basePath: 'http://localhost:3000',
  // Add authentication if needed
  // accessToken: 'your-token-here'
});

const api = new DefaultApi(config);

// Use the generated methods (based on operationId)
async function checkHealth() {
  try {
    const response = await api.getHealthCheck();
    console.log('Status:', response.status);
    console.log('Timestamp:', response.timestamp);
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

### Best Practices

#### 1. Version Your Generated Clients
```bash
# Generate with version
openapi-generator-cli generate \
  -i http://localhost:3000/api/openapi \
  -g typescript-fetch \
  -o ./generated/api-client-v1 \
  --additional-properties=npmVersion=1.0.0
```

#### 2. Automate Generation
Add to `package.json`:
```json
{
  "scripts": {
    "generate:client": "openapi-generator-cli generate -i http://localhost:3000/api/openapi -g typescript-axios -o ./generated/api-client"
  }
}
```

#### 4. Use Configuration Files
Create `openapi-generator-config.yaml`:
```yaml
generatorName: typescript-fetch
inputSpec: http://localhost:3000/api/openapi
outputDir: ./generated/api-client
additionalProperties:
  npmName: "@walrus/api-client"
  npmVersion: "1.0.0"
  supportsES6: true
  withInterfaces: true
```

Then run:
```bash
openapi-generator-cli generate -c openapi-generator-config.yaml
```

#### 5. Keep Schemas Consistent
- Always use `$ref` to reference shared schemas
- Add `operationId` to every endpoint
- Include detailed descriptions and examples
- Use proper HTTP status codes

### Validation Tools

Before generating, validate your spec:

```bash
# Using npx
npx @apidevtools/swagger-cli validate http://localhost:3000/api/openapi
# Project: 2025 Walrus Hackathon

## Project Overview

This is a Next.js web application built for the 2025 Walrus Hackathon. Based on the file structure and dependencies, this project appears to be a full-stack decentralized application (dApp) that interacts with the Sui blockchain.

The project follows a hybrid architecture, with a clear separation between the frontend and backend. 

- **Frontend**: Built with Next.js, React, and TypeScript. It uses a number of UI libraries, including `shadcn/ui`, `lucide-react`, and `tailwindcss`. State management is likely handled with `@tanstack/react-query`.
- **Backend**: The backend is built with Next.js API routes and follows a Controller-Service-Repository pattern. It uses `zod` for data validation. 
- **Blockchain**: The application interacts with the Sui blockchain, as indicated by the `@mysten/sui` and `@mysten/dapp-kit` dependencies and the `.move` files in `src/backend/contracts`.
- **API**: The project uses OpenAPI (Swagger) to define and document its API. A type-safe API client is generated from the OpenAPI specification.

## Building and Running

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### 3. Build for Production

```bash
npm run build
```

### 4. Run in Production Mode

```bash
npm run start
```

### 5. Lint the Code

```bash
npm run lint
```

### 6. Generate API Client

To regenerate the API client from the OpenAPI specification:

```bash
npm run generate:api-client
```
This command fetches the OpenAPI spec from `http://localhost:3000/api/openapi` and generates a TypeScript Fetch client in `src/frontend/lib/api-client`.

## Development Conventions

The project has a detailed `DEVELOPMENT_GUIDE.md` that outlines the following conventions:

- **Directory Structure**: A clear separation of concerns between `app`, `src/frontend`, `src/backend`, and `src/shared`.
- **Naming Conventions**: `kebab-case` for folders, `PascalCase` for React components, and `camelCase` for services/utilities.
- **Backend Architecture**: A layered architecture using the Controller-Service-Repository pattern.
- **Error Handling**: A structured approach to error handling, with domain-specific errors in the service layer and HTTP-specific errors in the controller layer.
- **API Versioning**: URL-based versioning (e.g., `/api/v1/...`).
- **API Documentation**: The API is documented using the OpenAPI specification. The generated documentation can be viewed at `/api-docs`.

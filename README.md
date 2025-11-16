This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Structure

This project follows a **Next.js Hybrid Architecture** pattern with clear frontend/backend separation:

```
/
├── app/
│   ├── (frontend)/         # Route group - Frontend pages
│   │   ├── page.tsx       # Homepage
│   │   └── ...            # Other frontend routes
│   │
│   ├── api/               # Backend API routes
│   │   ├── v1/           # API version 1
│   │   │   └── ...       # Other API endpoints
│   │   ├── health/       # Health check endpoint
│   │   └── openapi/      # OpenAPI specification endpoint
│   │
│   └── api-docs/          # API documentation page (Swagger UI)
│
├── src/
│   ├── backend/           # Backend: Controllers → Services → Repositories
│   ├── frontend/          # Frontend: Components, Hooks, Lib
│   └── shared/            # Shared: Types, Validators, Utils
│
├── docs/                  # OpenAPI specs organized by version
└── public/               # Static assets
```

> 📖 **For detailed development guidelines**, see [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)
>
> This includes:
> - Directory structure and responsibilities
> - Naming conventions
> - Backend layered architecture (Controller-Service-Repository pattern)
> - Error handling strategies
> - API versioning guidelines
> - **OpenAPI code generation** (auto-generate type-safe clients)
> - Testing strategies

## Getting Started

First, run the development server:

```bash
npm install

npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

<!-- BEGIN:nextjs-agent-rules -->
# Application Development Guide for Agents

## Technology Stack

- **Framework**: Next.js 16.2.9 (App Router)
- **UI Library**: React 19.2.4
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 with PostCSS
- **Linting**: ESLint 9
- **Data Processing**: xlsx (spreadsheet handling), jszip (compression)

This version has breaking changes — APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.

## Development Commands

All commands run from the `app/` directory:

- **`npm run dev`** — Start Next.js dev server with hot reload (port 3000)
- **`npm run build`** — Compile Next.js app for production, outputs to `.next/`
- **`npm start`** — Start production server (requires build first)
- **`npm run lint`** — Run ESLint on all TypeScript/JavaScript files

## Code Conventions

1. **Path Aliases**: Always use `@/*` alias for imports from app root (defined in tsconfig.json). Example: `import Button from '@/components/Button'`

2. **TypeScript Strict Mode**: All code must pass strict TypeScript checks. No `any` types without documented justification. Use explicit return types on functions.

3. **Component Organization**: 
   - Functional components only (no class components)
   - Co-locate styles with components using Tailwind classes
   - One component per file unless tightly coupled primitives

4. **File Naming**: 
   - Components: PascalCase (e.g., `UserProfile.tsx`)
   - Utilities/helpers: camelCase (e.g., `formatDate.ts`)
   - Hooks: camelCase with `use` prefix (e.g., `useAuth.ts`)

5. **ESLint Compliance**: All changes must pass `npm run lint` without errors. No lint-disable directives without clear reason.

## Guardrails

1. **Next.js 16 Breaking Changes**: This is NOT the Next.js you know. APIs and conventions differ from training data. Before writing code, check `node_modules/next/dist/docs/` for breaking changes and new patterns. Common issues: route structure, data fetching methods, middleware behavior.

2. **No Direct DOM Manipulation**: Use React state and event handlers. No `document.querySelector()`, `element.innerHTML`, or similar. React controls the DOM.

3. **TypeScript Strict Enforcement**: Strict mode is non-negotiable. All code paths must be properly typed. Missing types cause build failures.

4. **Performance**: Minimize bundle size. Avoid importing entire libraries; use tree-shakeable imports. Mark heavy computations with `useMemo` or `useCallback`.

5. **State Management**: Use React hooks (useState, useContext). No external state libraries unless justified. Prop drilling is acceptable for moderate depths.

## Architecture Notes

- Next.js App Router handles file-based routing in `app/` directory
- Server Components by default; mark interactive sections with `'use client'`
- Build output goes to `.next/` — do not commit
- Tailwind PostCSS processes CSS at build time
<!-- END:nextjs-agent-rules -->

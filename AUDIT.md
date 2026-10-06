# Git Audit - Grammar System Organization

## Current State
- Repository: Fresh git init (no commits)
- Branch: master (default)
- Status: All files untracked

## File Classification

### GRAMMAR (Core Grammar System)
- backend/src/modules/grammar/ - Grammar module (controller, service, DTOs, schemas)
- backend/scripts/grammar/ - Grammar pipeline scripts (extract, normalize, match, validate, etc.)
- backend/data/ - Grammar data files (raw, normalized, validated, generated, seed)
- backend/seed/grammar/ - Grammar seed files for database
- frontend/app/(dashboard)/dashboard/grammar/ - Grammar UI page
- backend/prisma/schema.prisma - GrammarPoint and GrammarExample models (SHARED)

### OUTRA FUNCIONALIDADE (Other Modules)
- backend/src/modules/analytics/ - Analytics module
- backend/src/modules/auth/ - Authentication module
- backend/src/modules/immersion/ - Immersion module
- backend/src/modules/kanji/ - Kanji module
- backend/src/modules/planner/ - Planner module
- backend/src/modules/review/ - Review module
- backend/src/modules/vocabulary/ - Vocabulary module
- frontend/app/(dashboard)/dashboard/admin/ - Admin UI
- frontend/app/(dashboard)/dashboard/ai/ - AI UI
- frontend/app/(dashboard)/dashboard/analytics/ - Analytics UI
- frontend/app/(dashboard)/dashboard/immersion/ - Immersion UI
- frontend/app/(dashboard)/dashboard/kanji/ - Kanji UI
- frontend/app/(dashboard)/dashboard/planner/ - Planner UI
- frontend/app/(dashboard)/dashboard/review/ - Review UI
- frontend/app/(dashboard)/dashboard/study/ - Study UI
- frontend/app/(dashboard)/dashboard/vocab/ - Vocabulary UI

### CONFIGURAÇÃO COMPARTILHADA (Shared Configuration)
- backend/package.json - Contains grammar scripts and dependencies
- backend/tsconfig.json - TypeScript configuration
- backend/eslint.config.mjs - ESLint configuration
- backend/.env.example - Environment variables template
- backend/prisma/schema.prisma - Complete database schema (grammar + other models)
- backend/prisma/seed.ts - General seed script
- frontend/package.json - Frontend dependencies
- frontend/tsconfig.json - Frontend TypeScript config
- frontend/next.config.mjs - Next.js configuration
- .gitignore - Git ignore rules

### REVISAR (Review Needed)
- backend/prisma/schema.prisma - Contains both grammar and other models in same file
- backend/package.json - Contains scripts for both grammar and other features

## Strategy
Since this is a fresh repository with no history, the approach will be:
1. Create initial commit with entire project (base infrastructure)
2. Create feature/grammar-system branch from master
3. Add grammar-specific files to the branch
4. For shared files (schema.prisma, package.json), include them as they are necessary for grammar to work

Note: The schema.prisma and package.json cannot be split safely as they contain both grammar and other functionality in the same file. These must be included as-is for the grammar system to function.

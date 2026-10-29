# Database Schema

This file is retained as a short index for compatibility with earlier project references. Its former statement that the Prisma schema was empty is outdated.

The authoritative, field-by-field description of the current PostgreSQL schema, relations, indexes, constraints, deletion behavior, migrations, privacy/ownership rules, and safe migration procedure is in [Database Documentation](./DATABASE_DOCUMENTATION.md). The source of truth is `backend/prisma/schema.prisma` and the checked-in migrations under `backend/prisma/migrations/`.

Current schema models: `User`, `Profile`, `Education`, `Experience`, `Skill`, `Project`, `Certificate`, `Portfolio`, and `AIGeneration`.

Migration warning: `20260919165434_add_ai_recommendation_status` adds a required `updated_at` column without a default. Review its effect on existing records before applying it to a populated database; do not reset data as a workaround.

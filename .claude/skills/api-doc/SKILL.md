---
name: api-doc
description: Generate OpenAPI 3.0 spec from NestJS controllers and DTOs. Scans all controller files, extracts routes, methods, parameters, DTOs, and permission decorators.
disable-model-invocation: true
---

# API Documentation Generator

Generate a complete OpenAPI 3.0 specification from the NestJS backend.

## Process

1. **Scan all controllers** in `backend/src/*/` — find every `@Controller`, `@Get`, `@Post`, `@Patch`, `@Delete`
2. **Extract route metadata**:
   - Path and HTTP method
   - `@RequiresPermission()` → security requirements
   - `@Public()` → no auth required
   - `@Throttle()` → rate limit info
   - `@Param()`, `@Query()`, `@Body()` → parameters and request bodies
3. **Extract DTO schemas** — read each DTO class, map `class-validator` decorators to JSON Schema:
   - `@IsString()` → `type: string`
   - `@IsUUID()` → `type: string, format: uuid`
   - `@IsNumber()` / `@IsInt()` → `type: number` / `type: integer`
   - `@IsIn([...])` → `enum: [...]`
   - `@IsOptional()` → not in `required`
   - `@Min()` / `@Max()` → `minimum` / `maximum`
4. **Group by tag** — each module (missions, tasks, orders, etc.) becomes an OpenAPI tag
5. **Output** — write `backend/openapi.yaml` in OpenAPI 3.0 format

## Usage

```
/api-doc
/api-doc orders        # Generate for specific module only
/api-doc --json        # Output as JSON instead of YAML
```

## Output Location

`backend/openapi.yaml` (or `backend/openapi.json` with --json flag)

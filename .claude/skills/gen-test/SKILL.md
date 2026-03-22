---
name: gen-test
description: Generate Jest unit tests for a NestJS service with Prisma mocking. Reads the service, its DTOs, and the Prisma schema to produce comprehensive test cases.
disable-model-invocation: true
---

# Test Generator

Generate Jest unit tests for NestJS services.

## Arguments

```
/gen-test <service-name>     # e.g., /gen-test orders
/gen-test <file-path>        # e.g., /gen-test src/orders/orders.service.ts
```

## Process

1. **Read the target service** file and its module
2. **Read all related DTOs** in the same module's `dto/` directory
3. **Read the Prisma schema** to understand model shapes and relations
4. **Identify dependencies** — what services/modules are injected
5. **Generate test file** at `src/<module>/<service>.spec.ts` with:

### Test Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';

// Mock PrismaService with jest.fn() for each model method used
const mockPrisma = {
  modelName: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    $transaction: jest.fn((fn) => fn(mockPrisma)),
  },
};
```

### Test Categories

For each public method in the service, generate:

- **Happy path** — normal inputs, expected output
- **Not found** — entity doesn't exist → `NotFoundException`
- **Validation** — invalid state transitions, business rule violations → `BadRequestException`
- **Authorization** — permission/ownership checks → `ForbiddenException`
- **Edge cases** — empty arrays, null optional fields, boundary values
- **Concurrency** — if the method uses `$transaction` with Serializable isolation

### Conventions

- Use `describe('MethodName', () => { ... })` grouping
- Mock all external dependencies (PrismaService, EventEmitter, other services)
- Use `beforeEach` to reset mocks
- Test error messages match exactly
- Do NOT test private methods directly

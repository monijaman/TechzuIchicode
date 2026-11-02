# Testing Documentation

## Testing approach

The backend is being developed using test-first development. The tests define the expected API behavior and business rules before the implementation is added.

The test stack is:

- **TypeScript**
- **Vitest** for unit and integration test execution
- **Supertest** for HTTP API testing
- **PostgreSQL** as the integration-test database
- **Prisma** for database access and transaction behavior

## Test commands

Run these commands from the `backend` directory:

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:integration
```

The test database is configured through `DATABASE_URL`. If it is not set, the test setup uses:

```text
postgresql://fb_user:fb_password@localhost:5432/fb_outlet_test
```

The test database must be separate from development and production databases.

## Tests written so far

### Menu and outlet assignment

File: `backend/tests/integration/menu.test.ts`

The suite verifies:

- A master menu item can be created.
- A menu item can be assigned to an outlet.
- An outlet-specific price can override the master price.
- An outlet receives only its assigned menu items.
- Duplicate menu assignments are rejected with HTTP `409`.

### Inventory

File: `backend/tests/integration/inventory.test.ts`

The suite verifies:

- Inventory is maintained independently for each outlet.
- Negative inventory values are rejected.
- A sale cannot consume more stock than is available.
- Failed stock operations do not change the stored inventory.

### Sales and receipt numbering

File: `backend/tests/integration/sales.test.ts`

The suite verifies:

- A multi-item sale can be created.
- Sale totals are calculated correctly.
- Inventory is deducted after a successful sale.
- A failed sale rolls back all inventory and sale changes.
- Receipt numbers start at one for an outlet.
- Ten concurrent sales receive unique sequential receipt numbers.

The transaction tests are important because sale creation must atomically coordinate receipt numbering, inventory deduction, and sale persistence.

### Reporting

File: `backend/tests/integration/reporting.test.ts`

The suite verifies:

- Revenue reporting is available for an outlet.
- Top-selling items reporting is available.
- An outlet with no sales returns an empty item list.

Additional tests should be added for date ranges, ties, pagination, and the exact top-five ordering once the reporting contract is finalized.

### Validation and errors

File: `backend/tests/integration/errors.test.ts`

The suite verifies:

- Invalid request payloads return HTTP `400`.
- Validation errors use the `VALIDATION_ERROR` code.
- Unknown routes return HTTP `404`.
- Error responses do not expose stack traces.

### Unit tests

Files: `backend/tests/unit/*.test.ts`

The executable unit tests cover:

- Outlet price overrides.
- Fallback to the master price.
- Rejection of zero and negative prices.
- Money calculations without floating-point errors.
- Sale line totals.
- Sale total calculation.
- Quantity validation.
- Inventory deduction and negative-stock prevention.
- Exact stock depletion, empty inventory, repeated deductions, and restocking.
- Large-quantity and whole-number validation rules.
- Sequential receipt-number domain rules.
- Receipt continuity, integer safety, invalid values, and safe-integer boundaries.
- Revenue summation and top-selling-item ranking.
- Empty and decimal revenue totals, repeated-item aggregation, deterministic ties, and ranking-limit validation.
- Menu item and sale request schemas.
- Whitespace names, missing fields, wrong data types, empty IDs, and malformed sale items.

## Current status

The tests are currently in the red phase of test-first development. The test runner and test contracts are ready, but the application implementation has not been created yet.

Current expected failure:

```text
Cannot find module '@/app.ts'
```

This is expected until `backend/src/app.ts` is implemented.

The tests target pure domain functions so business rules can be verified without HTTP or database setup. They are organized around sales pricing, inventory, receipts, reporting, and shared validation.

## Implementation order

Tests should be made green in this order:

1. Express application and error middleware
2. Prisma schema and test database reset utilities
3. Menu and outlet assignment endpoints
4. Inventory endpoints and stock constraints
5. Transactional sales and receipt numbering
6. Reporting queries
7. Unit-level pricing and calculation assertions
8. Coverage, concurrency, and failure-path improvements

## Future test coverage

Before deployment, add tests for:

- Authentication and authorization, if introduced
- Company isolation and cross-outlet access protection
- Pagination and filtering
- Database constraint violations
- Prisma transaction rollback failures
- Idempotency for offline synchronization
- Duplicate offline-sale replay
- Health and readiness endpoints
- Rate limiting and request-size limits
- Dockerized CI execution

## Additional coverage added

The expanded integration suite now also covers:

- PostgreSQL-backed uniqueness, foreign-key, and identifier constraints
- HQ versus outlet authorization boundaries
- Cross-outlet update protection
- Stable JSON response and error contracts
- Offline idempotency-key conflicts
- Invalid and boundary-inclusive reporting date ranges
- Database readiness failure responses

Before production deployment, the simulated readiness failure should be replaced
or supplemented with a controlled test that runs against an unavailable test
database. Authorization tests should also use the real authentication mechanism
once authentication is implemented; the current headers are test-contract
placeholders.

# F&B Outlet Management System

Centralized HQ and outlet management system for master menus, outlet-specific pricing, inventory, sales transactions, and reporting.

## Overview

```text
One company -> Multiple outlets -> HQ assigns menu items -> Outlets create sales -> HQ views reports
```

HQ manages the master menu and outlet assignments. Each outlet accesses its assigned menu, maintains local inventory, processes sales, and deducts stock safely.

## Features

- Create, edit, and delete master menu items (items with sales history are kept)
- Assign and unassign menu items per outlet
- Override menu prices per outlet
- Retrieve only the menu items assigned to an outlet
- Track inventory separately for each outlet
- Create multi-item sales and deduct inventory in one transaction
- Prevent negative stock
- Generate sequential receipt numbers per outlet
- Preserve receipt correctness during concurrent requests
- Report outlet revenue (optional date range) and top five selling items
- Idempotent offline-sale synchronization
- Company isolation, HQ and outlet roles, rotating refresh tokens
- React UI for HQ management and the outlet POS

## Technology Stack

- **Backend:** Node.js 20, Express 5, TypeScript, Prisma, Zod
- **Frontend:** React 19, Vite
- **Database:** PostgreSQL 16
- **Testing:** Vitest, Supertest
- **Deployment:** Docker, Docker Compose, GitHub Actions CI

## Project Structure

```text
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # data model
│   │   ├── migrations/         # SQL migrations with CHECK constraints and indexes
│   │   └── seed.ts             # demo company, outlets, menu, logins
│   ├── src/
│   │   ├── app.ts              # middleware chain and routers
│   │   ├── http/               # auth, validation, error, rate-limit middleware
│   │   ├── database/           # Prisma client and test reset
│   │   └── modules/            # auth, organization, menu, inventory, sales, reporting, offline-sync, shared
│   └── tests/                  # unit and integration suites
├── frontend/src/               # React SPA
├── database/init/              # creates the test database in Docker
├── docs/
│   ├── architecture.md         # design, scaling, microservices, offline POS/KDS
│   ├── erd.md                  # entity relationship diagram
│   ├── testing.md              # test plan and coverage
│   └── workspace.dsl           # Structurizr C4 model
├── .github/workflows/ci.yml
├── docker-compose.yml
├── Dockerfile                  # API image
└── README.md
```

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker and Docker Compose (recommended)

## Getting Started

### Option A: Docker (recommended)

1. Create a `.env` file in the project root with two long, different random secrets:

   ```env
   JWT_ACCESS_SECRET=replace-with-a-long-random-value
   JWT_REFRESH_SECRET=replace-with-a-different-long-random-value
   ```

2. Start everything:

   ```bash
   docker compose up --build
   ```

3. Open the app at <http://localhost:3105>. The API container is published on port `5105`; check <http://localhost:5105/health> for its health status. API routes are under `/api` (there is no page at the `/api` root).

4. Optional: load the demo data. This **wipes** the development database first.

   ```bash
   docker compose exec api npx prisma db seed
   ```

### Option B: Run locally

1. Start PostgreSQL, for example with `docker compose up db`.
2. Configure and start the API:

   ```bash
   cd backend
   cp .env.example .env        # then set DATABASE_URL and both JWT secrets
   npm install
   npm run db:deploy
   npm run db:seed             # optional demo data; wipes the database
   npm run dev
   ```

3. In a second terminal, start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Set `FRONTEND_ORIGIN` in `backend/.env` to the Vite URL (usually `http://localhost:5173`) so the browser is allowed to call the API.

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | none (Docker Compose builds it) | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes in production | dev-only fallback | Signs 15-minute access tokens |
| `JWT_REFRESH_SECRET` | yes in production | dev-only fallback | Signs 30-day refresh tokens. Must differ from the access secret |
| `FRONTEND_ORIGIN` | yes | `http://localhost:3000` | The only origin CORS allows |
| `PORT` | no | `5000` | API port |
| `VITE_API_URL` | build time | `http://localhost:5000/api` | API base URL baked into the frontend build |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Docker only | `fb_outlet`, `fb_user`, `fb_password` | Database container credentials. Change them outside local use |

The API refuses to start in production without both JWT secrets. A template is in [`backend/.env.example`](backend/.env.example). `.env` files are git-ignored.

### Demo logins (after seeding)

| Role | Email | Password |
|---|---|---|
| HQ | `hq@demo.local` | `demo-password-123` |
| Outlet (Downtown) | `downtown@demo.local` | `demo-password-123` |

These are for local use only. Never seed a shared environment.

## API Endpoints

Base URL: `/api`. All routes except `/auth/*` need `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/auth/register` | public | Create a company and its first HQ user |
| `POST` | `/auth/login` | public | Get access and refresh tokens |
| `POST` | `/auth/refresh` | public | Rotate a refresh token |
| `GET` | `/companies/:companyId/outlets` | HQ | List outlets |
| `POST` | `/companies/:companyId/outlets` | HQ | Create an outlet |
| `POST` | `/companies/:companyId/users` | HQ | Create an HQ or outlet user |
| `PUT` | `/companies/:companyId/users/:userId/outlet` | HQ | Reassign an outlet user to an outlet in the same company |
| `GET` | `/menu-items` | HQ | List the company master menu |
| `POST` | `/menu-items` | HQ | Create a master menu item |
| `PUT` | `/menu-items/:menuItemId` | HQ | Update name and/or base price |
| `DELETE` | `/menu-items/:menuItemId` | HQ | Delete an unassigned, unsold item |
| `POST` | `/outlets/:outletId/menu-items` | HQ | Assign a menu item to an outlet |
| `DELETE` | `/outlets/:outletId/menu-items/:menuItemId` | HQ | Unassign an item (removes its stock) |
| `PUT` | `/outlets/:outletId/menu-items/:menuItemId/price` | HQ | Override the outlet price |
| `GET` | `/outlets/:outletId/menu` | HQ, outlet | Assigned menu with effective prices |
| `GET` | `/outlets/:outletId/inventory` | HQ, outlet | Stock levels |
| `POST` | `/outlets/:outletId/inventory` | HQ, outlet | Create a stock record |
| `PUT` | `/outlets/:outletId/inventory/:menuItemId` | HQ, outlet | Set stock |
| `POST` | `/outlets/:outletId/sales` | HQ, outlet | Create a sale |
| `POST` | `/outlets/:outletId/sync/sales` | HQ, outlet | Idempotent sale (requires `Idempotency-Key`) |
| `GET` | `/reports/outlets/:outletId/revenue?from=&to=` | HQ, outlet | Revenue, optional date range |
| `GET` | `/reports/outlets/:outletId/top-items?limit=5` | HQ, outlet | Top-selling items |

Health checks: `GET /health` (process up) and `GET /ready` (database reachable).

Outlet users can only access their own outlet. HQ users can only access outlets and menu items in their own company.

### Request and response examples

**Log in**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hq@demo.local","password":"demo-password-123"}'
```

```json
{
  "user": { "id": "…", "email": "hq@demo.local", "role": "HQ", "companyId": "…", "outletId": null },
  "tokens": { "accessToken": "…", "refreshToken": "…", "tokenType": "Bearer", "expiresIn": 900 }
}
```

**Create a menu item and assign it with an outlet price**

```bash
curl -X POST http://localhost:5000/api/menu-items -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"Iced Latte","basePrice":180}'
# 201 {"id":"<itemId>","companyId":"…","name":"Iced Latte","basePrice":180,…}

curl -X POST http://localhost:5000/api/outlets/$OUTLET/menu-items -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"menuItemId":"<itemId>"}'
# 201

curl -X PUT http://localhost:5000/api/outlets/$OUTLET/menu-items/<itemId>/price -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"price":195}'
# 200 {"outletId":"…","menuItemId":"<itemId>","priceOverride":195,…}
```

**Get the outlet menu**

```json
GET /api/outlets/:outletId/menu
{ "items": [ { "id": "…", "name": "Iced Latte", "price": 195 } ] }
```

**Create a sale (offline-safe)**

```bash
curl -X POST http://localhost:5000/api/outlets/$OUTLET/sync/sales -H "Authorization: Bearer $TOKEN" \
  -H 'Idempotency-Key: pos-1-000123' -H 'Content-Type: application/json' \
  -d '{"items":[{"menuItemId":"<itemId>","quantity":2}]}'
```

```json
{
  "id": "…",
  "receiptNumber": 42,
  "totalAmount": 390,
  "items": [ { "id": "…", "menuItemId": "<itemId>", "quantity": 2, "unitPrice": 195, "lineTotal": 390 } ]
}
```

The first request returns `201`. Retrying with the same key and body returns `200` with the same sale, and stock is not deducted twice.

**Reports**

```json
GET /api/reports/outlets/:outletId/revenue?from=2026-11-01&to=2026-11-30
{ "totalRevenue": 390, "from": "2026-11-01", "to": "2026-11-30" }

GET /api/reports/outlets/:outletId/top-items?limit=5
{ "items": [ { "menuItemId": "…", "name": "Iced Latte", "quantity": 2 } ] }
```

**Errors** all share one shape:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Insufficient inventory for this sale" } }
```

| Status | Example codes |
|---|---|
| `400` | `VALIDATION_ERROR` (with `details`), `IDEMPOTENCY_KEY_REQUIRED` |
| `401` | `AUTHENTICATION_REQUIRED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS` |
| `403` | `FORBIDDEN` |
| `404` | `NOT_FOUND` |
| `409` | `CONFLICT`, `INSUFFICIENT_STOCK`, `MENU_ITEM_NOT_ASSIGNED`, `MENU_ITEM_IN_USE`, `IDEMPOTENCY_KEY_REUSED` |
| `429` | `RATE_LIMITED` |

## Database Schema

- **Company:** owns outlets, menu items, and users
- **Outlet:** an F&B location
- **MenuItem:** a master item in the company catalog
- **OutletMenuItem:** an outlet assignment with an optional outlet price
- **Inventory:** stock per outlet and assigned item
- **ReceiptCounter:** the last receipt number issued per outlet
- **Sale / SaleItem:** a transaction and its lines, with the price at the time of sale
- **User / RefreshToken:** local accounts, roles, and rotating sessions

See the diagram in [`docs/erd.md`](docs/erd.md).

## Architecture

### System overview

```text
HQ browser ─┐                         ┌─> PostgreSQL 16
            ├─> React SPA (nginx) ──> Express API (Node 20)
POS browser ┘                         └─> (future) cache, queue, read replica
```

The system is a **modular monolith**: one deployable API, with one module per business area (`auth`, `organization`, `menu`, `inventory`, `sales`, `reporting`, `offline-sync`). Each module is split into layers:

```text
Router (validation + auth middleware) -> Service (business rules, transactions) -> Prisma -> PostgreSQL
```

### Key design decisions

| Decision | Why |
|---|---|
| Modular monolith, not microservices | At 10 outlets, one service is simpler to run and test. Module boundaries already match future services |
| One transaction per sale | Sale creation, stock deduction, receipt numbering and the idempotency check commit together or not at all |
| Receipt counter row locked per outlet | Receipt numbers stay sequential under concurrency, and outlets never block each other |
| Business rules also enforced in the database | `CHECK`, unique and foreign-key constraints still hold if application code is bypassed |
| Price copied onto each sale line | Changing a price later never alters past receipts or reports |
| Idempotency key on offline sales | A POS can safely retry after a timeout or reconnect without double-charging |
| Stateless JWT auth | Any API instance can serve any request, so horizontal scaling needs no code changes |

### Architecture documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System overview, code structure, concurrency, security and tenancy, scaling, microservices evolution, offline POS/KDS |
| [`docs/erd.md`](docs/erd.md) | Entity relationship diagram (Mermaid) and key data rules |
| [`docs/workspace.dsl`](docs/workspace.dsl) | Structurizr C4 model: system context, containers and components |
| [`docs/testing.md`](docs/testing.md) | Test approach, commands and coverage by feature |

To view the C4 diagrams:

```bash
docker compose up structurizr
# open http://localhost:8080
```

## Validation and Error Handling

- Request bodies, route parameters, and query parameters are validated with Zod.
- Sales are rejected when stock is unavailable.
- PostgreSQL enforces foreign keys, unique constraints, and `CHECK` constraints (positive prices, non-negative stock, positive quantities).
- Central error middleware returns one consistent error shape and never exposes stack traces.

## Security

### In place

- **Passwords:** hashed with scrypt and a random salt, compared in constant time, minimum 12 characters.
- **Tokens:** HS256 JWTs. Access tokens last 15 minutes. Refresh tokens last 30 days, are stored hashed, and are rotated on every use, so a used refresh token is rejected.
- **Authorization:** `HQ` and `OUTLET` roles. Every outlet route checks that the outlet belongs to the caller's company, and outlet users can only reach their own outlet.
- **Tenant isolation:** another company's records are reported as `404 Not Found`, so their existence does not leak.
- **Input validation:** Zod schemas on every body, path parameter and query string.
- **CORS:** only `FRONTEND_ORIGIN` is allowed.
- **Rate limiting:** 100 requests per minute per IP on `/api`, returning `429` with `Retry-After`.
- **Secrets:** read from the environment and never committed. Production startup fails without them.
- **SQL injection:** prevented by Prisma's parameterized queries.

### Planned hardening

These are known gaps, listed by priority:

1. A stricter login limit and account lockout after repeated failures.
2. An atomic refresh-token revoke. When a used token is presented again, revoke all of that user's sessions.
3. A `POST /auth/logout` endpoint that revokes the refresh token.
4. Security headers (`helmet`: HSTS, CSP, nosniff, frame-deny).
5. Move the refresh token from `localStorage` to an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
6. Run the API container as a non-root user, and stop publishing the database port outside Docker.
7. Audit logging for logins, user and role changes, and price changes, plus `npm audit` in CI.

## Resilience

- **Health checks:** `GET /health` shows the process is up. `GET /ready` checks the database, so a load balancer can stop sending traffic to an instance that can't reach it.
- **Safe retries:** sales sent through `/sync/sales` are idempotent, so clients can retry freely.
- **Rate limiting:** the limiter is in memory today. Behind a load balancer it moves to Redis with `trust proxy` enabled, and it should count per user or outlet rather than per IP, because the tills in one outlet often share one IP.
- **Circuit breaker:** not added yet, on purpose. The API calls no external services, and its only dependency, PostgreSQL, has no fallback (a sale can't be saved without it). Database pool and statement timeouts are the right protection for now. A circuit breaker (for example `opossum`) will wrap the first external integration, such as payments or SMS, with a fallback for each call.

## Testing

Run from `backend/` with PostgreSQL running (`docker compose up db` creates the `fb_outlet_test` database):

```bash
npm test
npm run test:coverage
```

The suite has 111 unit and integration tests in 19 files, all passing. It covers menu assignment and pricing, inventory, concurrent sales and receipts, reports, offline retries, constraints, and company and role isolation using real bearer tokens. CI runs the same suite on every push. See [`docs/testing.md`](docs/testing.md).

## Deployment

- **Live application:** _not deployed yet_
- **API documentation:** see [API Endpoints](#api-endpoints) above
- **Repository:** <https://github.com/monijaman/TechzuIchicode>

## Scaling Strategy

For 10 outlets and about 100,000 transactions a month (a peak of roughly 5–10 sales a second):

- Indexes are already in place on outlet and sale date, receipt number, sale items, and idempotency keys.
- Use connection pooling (PgBouncer) and read replicas for reports.
- Add a background job that maintains daily summary tables once history grows.
- The API is stateless, so it can scale horizontally behind a load balancer. Move the rate limiter to Redis at that point.
- Add centralized logging, monitoring, backups, and alerting.

Details are in [`docs/architecture.md`](docs/architecture.md#5-scaling-strategy-10-outlets-about-100000-transactions-a-month).

## Future Architectural Evolution

The modules map onto future services: identity, catalog, inventory, sales, reporting, and a sync gateway. The migration path uses an outbox and domain events, extracts reporting first, and replaces the shared sale transaction with a stock-reservation saga only after sales and inventory are split. See [`docs/architecture.md`](docs/architecture.md#6-microservices-evolution).

## Offline POS Mode Strategy

The POS caches its menu and stock snapshot, writes each sale to a durable local queue with an idempotency key, and talks to the KDS over the local network while the internet is down. When it reconnects, it replays the queue through `/sync/sales`, which is implemented and tested to be safe on retry. See [`docs/architecture.md`](docs/architecture.md#7-offline-pos-and-kds-strategy).

## Assumptions and Known Limitations

- Each user belongs to one company. Outlet users belong to exactly one outlet.
- A single currency is used, and amounts are stored as decimals.
- Online sales are rejected when stock is short. Offline sales that would make stock negative are planned to be accepted and flagged instead (see [offline strategy](docs/architecture.md#7-offline-pos-and-kds-strategy)).
- The offline queue and KDS link are designed but not built. The server side (`/sync/sales`) is implemented and tested.
- Anyone can call `/auth/register` to create a company. A real deployment would require an invite or email verification.
- Reports aggregate live data. Daily summary tables are planned for when history grows.

## Assessment Requirements

- [ ] Deployed instance
- [x] GitHub repository
- [x] Clean commits and proper folder structure
- [x] Layered architecture, validation, error middleware, and environment configuration
- [x] PostgreSQL constraints and appropriate indexes
- [x] Dockerfile and Docker Compose
- [x] README, ERD, and architecture documentation (including a C4 model)
- [x] Authentication, role-based access, and tenant isolation
- [x] Rate limiting and health/readiness checks
- [x] Automated tests (111) running in CI
- [x] Scaling strategy for 10 outlets and 100,000 monthly transactions
- [x] Microservices evolution strategy
- [x] Offline POS and KDS synchronization strategy

## License

This project was created as a technical assessment.

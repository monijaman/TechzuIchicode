# Architecture

This document explains how the F&B Outlet Management System is built today, how it scales to 10 outlets and about 100,000 transactions a month, and how it can evolve into services and support offline POS and KDS operation.

The C4 model source lives in [`workspace.dsl`](workspace.dsl), and its exported diagrams are in [`c4/`](c4). The data model is in [`erd.md`](erd.md). The current Docker Compose file does not run Structurizr.

## 1. System overview

```text
HQ browser ─┐                         ┌─> PostgreSQL 16
            ├─> React SPA (nginx) ──> Express API (Node 20)
POS browser ┘                         └─> (future) cache, queue, read replica
```

- **Frontend:** a React single-page app built by Vite and served by nginx. It stores the session locally, refreshes access tokens automatically, and sends POS checkouts with an idempotency key.
- **API:** one Express process, organized as a modular monolith.
- **Database:** PostgreSQL is the source of truth. Constraints enforce the business rules that must never break, even if application code is bypassed.

## 2. Code structure

The backend is a modular monolith. Each business module owns its routes and services:

```text
backend/src/
├── app.ts                    # middleware chain and router mounting
├── http/                     # cross-cutting middleware
│   ├── auth.ts               # bearer authentication, HQ role, outlet access checks
│   ├── errors.ts             # validation helpers and central error handler
│   └── rate-limit.ts         # per-IP request limit
├── database/                 # Prisma client, test database reset
└── modules/
    ├── auth/                 # register, login, refresh, user provisioning
    ├── organization/         # companies and outlets
    ├── menu/                 # master catalog, assignment, outlet prices
    ├── inventory/            # per-outlet stock
    ├── sales/                # transactional sales, receipts, idempotency
    ├── reporting/            # revenue and top-selling items
    └── shared/validation/    # Zod request schemas
```

Requests flow through these layers:

```text
Router (HTTP + validation + authorization middleware)
  -> Service (business rules, transactions)
    -> Prisma client (data access)
      -> PostgreSQL (constraints, indexes)
```

The plan described separate controller and repository layers. They were folded into routers and services because each handler is a few lines and Prisma already acts as the repository. Pure business rules (pricing, receipts, stock math, report ranking) live in `modules/*/domain/` and are unit-tested without a database. If a module grows, the next step is to extract a repository interface per module, which is also the seam for splitting it into a service later.

## 3. Correctness under concurrency

A sale runs in one database transaction:

1. If an idempotency key is present, return the existing sale with that key. A different body with the same key returns `409`.
2. Check the outlet exists and every item is assigned to it.
3. Increment the outlet's `ReceiptCounter`. This row lock serializes receipt allocation per outlet only, so other outlets are not blocked.
4. For each line, run a conditional update: `quantity = quantity - n WHERE quantity >= n`. If no row changes, the sale fails with `INSUFFICIENT_STOCK`.
5. Insert the sale and its lines with the price at the time of sale.

Any failure rolls everything back, including the receipt number, so receipts stay sequential and gap-free. The `CHECK (quantity >= 0)` constraint is a final guard. Integration tests run ten concurrent sales on one outlet and race two sales for the last unit of stock.

## 4. Security and tenancy

- **Authentication:** local accounts with hashed passwords. Access tokens last 15 minutes. Refresh tokens rotate on every use and are stored hashed, so a reused token is rejected.
- **Roles:** `HQ` users manage their company's catalog, outlets, prices and users. `OUTLET` users can only reach their own outlet: menu, stock, sales and reports.
- **Tenancy:** every outlet route checks the outlet belongs to the caller's company. Menu items are owned by a company. Another company's item is reported as "not found" so its existence does not leak.
- **Abuse limits:** a per-IP rate limit on `/api`. Behind a load balancer this should move to a shared store (for example Redis) and use `trust proxy`.

## 5. Scaling strategy: 10 outlets, about 100,000 transactions a month

100,000 transactions a month is about 3,300 a day, or a peak of maybe 5–10 sales a second at lunch across all outlets. A single API instance and PostgreSQL handle this comfortably. The plan below keeps headroom and protects report performance as history grows.

| Concern | Approach |
|---|---|
| Write path | Sales lock only one outlet's receipt counter, so outlets never contend with each other. Keep transactions short and avoid network calls inside them. |
| Indexes | Already in place: `Sale(outletId, soldAt)` for date-range reports, unique `Sale(outletId, receiptNumber)`, `SaleItem(menuItemId)`, unique `(outletId, idempotencyKey)`. |
| Connections | Use Prisma connection pooling, and PgBouncer when running more than one API instance. |
| Reports | At about 1.2M sales a year, live aggregation stays fast with the indexes above. Past that, maintain a daily `outlet_item_sales` summary table from a background job, and serve reports from a read replica. |
| Horizontal scale | The API is stateless (JWT auth), so run 2+ instances behind a load balancer. Move the rate limiter to Redis. |
| Data growth | Partition `Sale` and `SaleItem` by month once tables reach tens of millions of rows, and archive old partitions. |
| Operations | Structured logs with request IDs, metrics (latency, error rate, sales per minute), alerts on failed sales and readiness, daily backups with tested restore, and point-in-time recovery. |

## 6. Microservices evolution

The modules map directly onto future services. Extract a service only when there is a real reason, such as independent scaling, a separate team, or a different release cadence.

| Service | Owns | Notes |
|---|---|---|
| Identity | users, sessions, roles | First to extract if single sign-on or more apps are added. |
| Catalog | companies, outlets, menu items, outlet prices | Publishes `MenuItemChanged` and `PriceChanged` events. |
| Inventory | stock per outlet | Consumes `SaleCompleted` and can reserve stock. |
| Sales | sales, receipts, idempotency | The critical write path, kept small and highly available. |
| Reporting | read models built from events | Owns its own read-optimized database. |
| Sync gateway | offline POS uploads | Validates and forwards queued sales. |

Migration path:

1. Put a repository interface in front of each module's data access.
2. Publish domain events from the monolith through an outbox table.
3. Move reporting first. It is read-only and fed by events, so the risk is lowest.
4. Extract the other services one at a time behind the same API gateway routes, so clients do not change.

Stock deduction and receipt allocation stay in one transaction until sales and inventory are split. After the split, use a saga with stock reservation and compensation instead of a distributed transaction.

## 7. Offline POS and KDS strategy

Goal: an outlet keeps selling and the kitchen keeps cooking when the internet is down, and HQ data is reconciled correctly when it returns.

**On the outlet's local network**

- The POS caches the assigned menu, prices and a stock snapshot, refreshed whenever it is online.
- Each sale is written first to a durable local queue (IndexedDB or SQLite) with a client-generated idempotency key and a local provisional receipt number, for example `OFFLINE-<device>-<n>`.
- The POS sends orders to the KDS directly over the LAN (WebSocket or a small local hub). Kitchen flow therefore never depends on the internet.

**When connectivity returns**

- The POS replays queued sales in order to `POST /api/outlets/:outletId/sync/sales`, each with its `Idempotency-Key`. This endpoint is implemented and tested.
- Replaying the same key returns the original sale with `200`, so retries after timeouts never double-charge or double-deduct stock.
- The same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED` and is flagged for review.
- The server assigns the official sequential receipt number and stores it next to the provisional one.

**Conflict rules**

- Sales are append-only facts and are never silently dropped.
- If an offline sale would make stock negative on the server, the server should accept it, record a stock discrepancy for the outlet manager, and not block the sale. This is a planned change: today the API rejects it with `INSUFFICIENT_STOCK`, which suits online sales.
- Prices are the ones cached at the time of sale. HQ price changes apply only to sales made after the POS syncs the new menu.

# F&B Outlet Management System

Centralized HQ and outlet management system for master menus, outlet-specific pricing, inventory, sales transactions, and reporting.

## Overview

```text
One company -> Multiple outlets -> HQ assigns menu items -> Outlets create sales -> HQ views reports
```

HQ manages the master menu and outlet assignments. Each outlet accesses its assigned menu, maintains local inventory, processes sales, and deducts stock safely.

## Features

- Create and manage master menu items
- Assign menu items to individual outlets
- Override menu prices per outlet
- Retrieve only the menu items assigned to an outlet
- Track inventory separately for each outlet
- Create multi-item sales and deduct inventory
- Prevent negative stock
- Generate sequential receipt numbers per outlet
- Preserve receipt correctness during concurrent requests
- Report outlet revenue and top five selling items

## Technology Stack

- **Backend:** Node.js, Express.js
- **Frontend:** React.js
- **Database:** PostgreSQL
- **Deployment:** Docker, Docker Compose

## Project Structure

```text
.
├── backend/src/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── middleware/
│   ├── validators/
│   └── config/
├── frontend/
├── database/migrations/
├── database/seeds/
├── docs/architecture.md
├── docs/erd.png
├── docker-compose.yml
├── Dockerfile
└── README.md
```

> Update this tree to match the final implementation.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker and Docker Compose (recommended)

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

### 2. Configure environment variables

Create `.env` from `.env.example`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fb_outlet
```

### 3. Run the database

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the application

```bash
npm run dev
```

### Docker

```bash
docker compose up --build
```

The current Compose setup starts PostgreSQL and Structurizr Lite. View the C4 diagrams at <http://localhost:8080>:

```bash
docker compose up db structurizr
```

The application image in [`Dockerfile`](Dockerfile) is ready for the backend once `backend/package.json` and the backend source are added.

## API Endpoints

Base URL: `/api`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/menu-items` | Create a master menu item |
| `GET` | `/menu-items` | List master menu items |
| `POST` | `/outlets/:outletId/menu-items` | Assign a menu item |
| `GET` | `/outlets/:outletId/menu` | Get the outlet menu |
| `PUT` | `/outlets/:outletId/menu-items/:menuItemId/price` | Override outlet price |
| `GET` | `/outlets/:outletId/inventory` | View inventory |
| `PUT` | `/outlets/:outletId/inventory/:menuItemId` | Update stock |
| `POST` | `/outlets/:outletId/sales` | Create a sale |
| `GET` | `/reports/outlets/:outletId/revenue` | View outlet revenue |
| `GET` | `/reports/outlets/:outletId/top-items` | View top five items |

> Add request and response examples for the main endpoints before submission.

## Database Schema

The main entities are:

- **Company:** Owns multiple outlets
- **Outlet:** Represents an F&B location
- **MenuItem:** Master item managed by HQ
- **OutletMenuItem:** Outlet assignment and optional outlet price
- **Inventory:** Stock per outlet and menu item
- **Sale:** Transaction and sequential outlet receipt number
- **SaleItem:** Items and quantities in a sale

See [`docs/architecture.md`](docs/architecture.md), [`docs/workspace.dsl`](docs/workspace.dsl), and [`docs/erd.png`](docs/erd.png).

## Architecture

```text
Routes -> Controllers -> Services -> Repositories -> PostgreSQL
```

- **Routes** define HTTP endpoints.
- **Controllers** handle requests and responses.
- **Services** contain business rules and transaction orchestration.
- **Repositories** handle database access.
- **Middleware** handles validation, authentication, and errors.
- **Constraints and indexes** protect integrity and improve performance.

Sales creation, inventory deduction, and receipt generation must run inside one database transaction so concurrent requests remain consistent.

## Validation and Error Handling

- Validate request bodies, route parameters, and query parameters.
- Reject sales when requested stock is unavailable.
- Enforce foreign keys and unique constraints in PostgreSQL.
- Return consistent errors through centralized error middleware.

## Testing

```bash
npm test
npm run test:coverage
```

Cover menu assignment, outlet pricing, inventory deduction, insufficient stock, receipt sequencing, concurrent sales, and reports.

See [`docs/testing.md`](docs/testing.md) for the detailed test plan and current implementation status.

## Deployment

- **Live application:** <deployed-instance-url>
- **API documentation:** <api-documentation-url>
- **Repository:** <github-repository-url>

## Scaling Strategy

For 10 outlets and approximately 100,000 transactions per month:

- Add indexes on outlet, sale date, receipt number, and sale-item fields.
- Use connection pooling, query optimization, and read replicas for reports.
- Use background jobs or pre-aggregated tables for analytics.
- Horizontally scale the application behind a load balancer.
- Add centralized logging, monitoring, backups, and alerting.

See [`docs/architecture.md`](docs/architecture.md) for the detailed plan.

## Future Architectural Evolution

Potential services include menu and outlet management, inventory, sales and receipts, reporting, and offline synchronization. The current modular monolith keeps deployment simple while preserving boundaries for future extraction into microservices.

## Offline POS Mode Strategy

The POS can cache its menu and inventory snapshot locally, store sales in a durable queue, and synchronize after connectivity returns. Use idempotency keys, conflict-resolution rules, server-side validation, and append-only sales records. POS and KDS can communicate over the local network while the internet is unavailable, then reconcile with HQ.

## Assessment Requirements

- Deployed instance and GitHub repository
- Clean commits and proper folder structure
- Layered architecture, validation, error middleware, and environment configuration
- PostgreSQL constraints and appropriate indexes
- Dockerfile and Docker Compose
- README, ERD, and architecture documentation
- Scaling strategy for 10 outlets and 100,000 monthly transactions
- Microservices evolution strategy
- Offline POS and KDS synchronization strategy

## License

This project was created as a technical assessment.

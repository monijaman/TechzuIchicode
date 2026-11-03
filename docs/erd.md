# Entity Relationship Diagram

Generated from [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma). GitHub renders the Mermaid diagram below.

```mermaid
erDiagram
    Company ||--o{ Outlet : owns
    Company ||--o{ MenuItem : "owns catalog"
    Company ||--o{ User : employs
    Outlet ||--o{ User : "outlet staff"
    User ||--o{ RefreshToken : "has sessions"
    Outlet ||--o{ OutletMenuItem : "is assigned"
    MenuItem ||--o{ OutletMenuItem : "assigned to"
    OutletMenuItem ||--o| Inventory : "stocked as"
    Outlet ||--|| ReceiptCounter : "numbers receipts"
    Outlet ||--o{ Sale : records
    Sale ||--|{ SaleItem : contains
    MenuItem ||--o{ SaleItem : "sold as"

    Company {
        uuid id PK
        string name
    }
    Outlet {
        uuid id PK
        uuid companyId FK
        string name "unique per company"
    }
    MenuItem {
        uuid id PK
        uuid companyId FK
        string name
        decimal basePrice "CHECK > 0"
    }
    OutletMenuItem {
        uuid outletId PK, FK
        uuid menuItemId PK, FK
        decimal priceOverride "nullable, CHECK > 0"
    }
    Inventory {
        uuid outletId PK, FK
        uuid menuItemId PK, FK
        int quantity "CHECK >= 0"
    }
    ReceiptCounter {
        uuid outletId PK, FK
        int lastIssued "row lock serializes receipts"
    }
    Sale {
        uuid id PK
        uuid outletId FK
        int receiptNumber "unique per outlet"
        string idempotencyKey "unique per outlet, nullable"
        string idempotencyFingerprint
        decimal totalAmount
        timestamptz soldAt "indexed with outletId"
    }
    SaleItem {
        uuid id PK
        uuid saleId FK
        uuid menuItemId FK "indexed"
        int quantity "CHECK > 0"
        decimal unitPrice "price at time of sale"
        decimal lineTotal
    }
    User {
        uuid id PK
        uuid companyId FK
        uuid outletId FK "required for OUTLET role"
        string email "unique"
        string passwordHash
        enum role "HQ or OUTLET"
    }
    RefreshToken {
        uuid id PK
        uuid userId FK
        string tokenHash "unique"
        timestamptz expiresAt
        timestamptz revokedAt
    }
```

## Key rules

- `Inventory` references the `OutletMenuItem` assignment, so an outlet can only stock items it was assigned. Unassigning an item removes its stock row.
- `SaleItem` stores `unitPrice` at the time of sale, so later price changes never rewrite history. Sold menu items cannot be deleted (`ON DELETE RESTRICT`).
- `ReceiptCounter` is incremented inside the sale transaction. The row lock gives each outlet gap-free, sequential receipt numbers under concurrent requests.

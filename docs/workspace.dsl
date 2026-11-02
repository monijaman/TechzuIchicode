workspace "F&B Outlet Management System" "HQ and outlet management for menus, inventory, sales, and reporting." {

    !identifiers hierarchical

    model {
        company = person "Company User" "An authorized HQ or outlet user." {
            tags "Person"
        }

        pos = softwareSystem "F&B Outlet Management System" "Manages master menus, outlet assignments, inventory, sales, receipts, and reports." {
            hq = container "HQ Management" "Maintains master menu items, outlet assignments, outlet prices, and reports." "React.js / Node.js" "HQ"
            outlet = container "Outlet Operations" "Provides outlet menu, inventory, and sales workflows." "React.js / Node.js" "Outlet"
            api = container "Application API" "Validates requests and coordinates business operations." "Node.js / Express.js" "API" {
                menu = component "Menu Service" "Manages master menu and outlet assignments." "Service layer" "Menu"
                inventory = component "Inventory Service" "Tracks stock per outlet and prevents negative stock." "Service layer" "Inventory"
                sales = component "Sales Service" "Creates transactional sales and sequential receipts." "Service layer" "Sales"
                reporting = component "Reporting Service" "Calculates revenue and top-selling items." "Service layer" "Reporting"
            }
            database = container "PostgreSQL Database" "Stores outlets, menu assignments, inventory, sales, and reporting data." "PostgreSQL" "Database"
            sync = container "Offline Sync Queue" "Queues offline POS sales and synchronizes them when connectivity returns." "Local POS storage / API" "Offline"
        }

        company -> pos "Uses"
        pos.hq -> pos.api "Uses"
        pos.outlet -> pos.api "Uses"
        pos.api -> pos.database "Reads and writes data"
        pos.outlet -> pos.sync "Stores sales while offline"
        pos.sync -> pos.api "Synchronizes queued sales"

        pos.api.menu -> pos.database "Reads/writes menu data"
        pos.api.inventory -> pos.database "Reads/writes stock"
        pos.api.sales -> pos.database "Transactional sales and receipt numbering"
        pos.api.reporting -> pos.database "Queries sales data"
    }

    views {
        systemContext pos "SystemContext" {
            include *
            autolayout lr
        }

        container pos "Containers" {
            include *
            autolayout lr
        }

        component pos.api "ApiComponents" {
            include *
            autolayout lr
        }

        styles {
            element "Person" {
                shape person
                background #08427b
                color #ffffff
            }
            element "Software System" {
                background #1168bd
                color #ffffff
            }
            element "Container" {
                background #438dd5
                color #ffffff
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "HQ" {
                background #7b2cbf
                color #ffffff
            }
            element "Outlet" {
                background #f77f00
                color #ffffff
            }
            element "API" {
                background #0077b6
                color #ffffff
            }
            element "Database" {
                shape cylinder
                background #2a9d8f
                color #ffffff
            }
            element "Offline" {
                background #e63946
                color #ffffff
            }
            element "Menu" {
                background #90be6d
                color #000000
            }
            element "Inventory" {
                background #43aa8b
                color #000000
            }
            element "Sales" {
                background #f9c74f
                color #000000
            }
            element "Reporting" {
                background #f9844a
                color #000000
            }
        }
    }
}

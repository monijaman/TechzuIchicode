# Architecture Documentation

## Structurizr

The C4 model is defined in [`workspace.dsl`](workspace.dsl).

Start Structurizr Local with Docker:

```bash
docker compose up structurizr
```

Then open <http://localhost:8080>.

The model currently includes:

- System context view
- Container view
- Application API component view
- HQ and outlet users
- PostgreSQL persistence
- Offline POS synchronization flow

As the implementation is built, replace the component placeholders with the actual modules and add deployment views for development and production.

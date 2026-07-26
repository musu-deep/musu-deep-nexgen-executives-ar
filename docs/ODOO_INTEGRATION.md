# Odoo Integration Environment

NEXGEN EXECUTIVES can use Odoo as the operational source for projects and tasks while keeping the executive platform responsible for dashboards, risks, briefings, decisions, and AI-generated insights.

## Supported modes

- `mongo`: use the platform database only.
- `odoo`: read projects and tasks directly from Odoo. Odoo failures return a service error.
- `hybrid`: merge Odoo records with platform-native records. If Odoo is unavailable, the platform continues with its own database. This is the recommended rollout mode.

Set the provider with:

```env
OPERATIONAL_DATA_SOURCE=hybrid
```

The frontend `Demo`, `Live`, and `Auto` selector remains unchanged:

- `Live` reads the operational API. The API may be backed by Mongo, Odoo, or hybrid mode.
- `Auto` tries the operational API and falls back to demo data when the live API is unavailable.
- `Demo` always uses simulation data.

## Odoo versions

- Odoo 19: the connector prefers External JSON-2.
- Odoo 14-18: the connector uses XML-RPC with an API key.
- `ODOO_PROTOCOL=auto` reads `/web/version` and selects the best supported protocol, with a fallback where possible.

## Required environment variables

```env
ODOO_ENABLED=true
ODOO_URL=https://company.odoo.com
ODOO_DATABASE=database_name
ODOO_USERNAME=integration@company.com
ODOO_API_KEY=replace-with-a-server-side-secret
ODOO_PROTOCOL=auto
ODOO_READ_ONLY=true
ODOO_TIMEOUT=20
```

For Odoo 19 JSON-2, the username may not be required. For XML-RPC it is required together with the database name.

Never add `ODOO_API_KEY` to a `VITE_` variable. Vite variables can be exposed to browser bundles. Store all Odoo credentials only in backend or Vercel server environment variables.

## Mapping

The first release maps:

- `project.project` to platform projects.
- `project.task` to platform tasks.

The connector discovers available fields with `fields_get` before requesting data, so optional and custom fields do not break the integration.

Optional custom mapping:

```env
ODOO_PROJECT_BUDGET_FIELD=x_budget
ODOO_PROJECT_SECTOR_FIELD=x_sector
ODOO_PROJECT_PROGRESS_FIELD=progress
ODOO_TASK_SECTOR_FIELD=x_sector
ODOO_TASK_PROGRESS_FIELD=progress
ODOO_DEFAULT_SECTOR=corporate
ODOO_SECTOR_MAP_JSON={"investment":"investment","digital":"digital","academy":"academy","operations":"arak_development"}
```

Optional Odoo domains:

```env
ODOO_PROJECT_DOMAIN=[["active","=",true]]
ODOO_TASK_DOMAIN=[["active","=",true]]
```

## API endpoints

Authenticated users:

- `GET /api/odoo/status`: safe configuration status; never returns the API key.
- `GET /api/odoo/projects`: direct Odoo project mapping.
- `GET /api/odoo/tasks`: direct Odoo task mapping.

CEO and admin:

- `POST /api/odoo/test`: verifies the server, API key, database, and resolved protocol.

Operational endpoints automatically use the selected provider:

- `GET /api/projects`
- `GET /api/projects/{id}`
- `GET /api/tasks`
- `GET /api/dashboard`

## Platform page

The sidebar contains **بيئة تكامل Odoo** for CEO and admin roles. It shows:

- provider mode;
- configuration completeness;
- protocol and Odoo version;
- server-side API-key status;
- read-only protection;
- active and planned Odoo model mappings;
- a live connection test.

## Recommended rollout

1. Create a dedicated Odoo integration user with the minimum read permissions required.
2. Generate an API key for that user.
3. Start with `OPERATIONAL_DATA_SOURCE=hybrid` and `ODOO_READ_ONLY=true`.
4. Map custom budget, sector, and progress fields.
5. Validate projects, tasks, roles, totals, dates, and dashboard indicators.
6. Move to `OPERATIONAL_DATA_SOURCE=odoo` only when Odoo is ready to become the sole operational source.
7. Add write-back actions later through explicitly approved workflows rather than granting broad write access from the first release.

# Finguard — Project overview

This document is a **single-place description** of the Finguard repository: what it is, how it is built, and the capabilities that make it a strong portfolio/demo of fraud-engine patterns.

---

## What this project is

**Finguard** is a **real-time fraud / risk decisioning demo**: payment-like events enter an API, are buffered in **Redis Streams**, consumed by a **risk worker** that runs a **configurable rule engine**, and produce **APPROVED / REVIEW / DECLINED** outcomes persisted in **PostgreSQL**, with **live metrics** pushed to an **Angular** dashboard over **WebSockets**.

It is intentionally **small and readable** while mirroring patterns used in production payment and risk platforms (event streams, idempotency, retries, DLQ, observability).

---

## Tech stack

| Layer | Technology | Notes |
|--------|------------|--------|
| API & worker runtime | **Node.js**, **TypeScript** | Single process runs HTTP + in-process worker loop |
| HTTP framework | **Fastify 5** | Routes, plugins, logging via **Pino** / **pino-pretty** |
| Real-time | **@fastify/websocket** | `GET /ws/metrics` broadcasts JSON `metrics_update` messages |
| Cache / streams | **Redis 7** (Docker), **ioredis** | Stream `transactions_stream`, consumer group `risk_workers`, DLQ stream `transactions_dlq` |
| Database | **PostgreSQL 15** (Docker), **pg** | Decisions, alerts, rule config, idempotency table |
| Frontend | **Angular 21** (standalone components) | Router, **RxJS**, **HttpClient** |
| UI | **Bootstrap 5**, **ng-bootstrap 20** | Layout, cards, modals |
| Charts | **Chart.js 4**, **ng2-charts 9** | Pie (decision mix) and horizontal bar (alerts by rule) on dashboard |
| Testing (frontend) | **Vitest** (via Angular build) | `ng test` |
| Tooling | **Docker Compose**, **npm** | Postgres + Redis volumes; backend loads root `../.env` from `backend/` |

**Backend dependencies (high level):** `@fastify/cors`, `@fastify/websocket`, `dotenv`, `fastify`, `fastify-plugin`, `ioredis`, `pg`, `pino`.

**Ports (defaults):** API `4000`, Angular dev server `4200`, Postgres `5433` (Docker; host 5432 may be a local install), Redis `6379`.

---

## Architecture (data flow)

1. **Client or simulator** → `POST /events` → event **`XADD`** to Redis stream `transactions_stream` (fields include `source`, default `CLIENT` or `SIMULATOR` from the UI).
2. **Transaction worker** (`transactionWorker.ts`) reads via **`XREADGROUP`**, processes with **`processEvent`**:
   - **Idempotency:** insert into `processed_transactions` (unique `transaction_id`; duplicates are skipped and ACKed).
   - **Rules:** each rule in `backend/src/rules` contributes severity; scores map to **APPROVED** (low), **REVIEW** (medium), **DECLINED** (high) using thresholds in code (`riskScore >= 5` → DECLINED, `>= 2` → REVIEW).
   - **Persist:** `transaction_decisions`; rules upsert **`fraud_alerts`** for explainability.
   - **Metrics:** in-memory registry + WebSocket fan-out to dashboards.
   - **ACK** on success; on failure, **Redis retry counter**; after **5** failures → **`XADD` to `transactions_dlq`** and ACK.
3. **Startup recovery:** **`XAUTOCLAIM`** reclaims idle pending messages for consumer `worker-1`.
4. **Rule config:** loaded from **`rule_config`** at startup; a dedicated **`pg.Client`** **`LISTEN rule_config_updated`** is intended to trigger reloads (see *Operational gaps* below).

---

## Gold / flagship features

These are the qualities that make the project stand out for reviewers and hiring loops:

1. **End-to-end realism** — Stream-backed ingestion, async worker, DB persistence, not a synchronous “if/else in a route handler” toy.
2. **Explainable risk** — Explicit rules, severities, and **`fraud_alerts`** keyed by rule type so the UI can show *what* fired.
3. **Reliability story** — **Idempotency**, **bounded retries** without ACK, **DLQ** with inspectable payloads, **pending-message reclaim** after restarts.
4. **Live observability** — **WebSocket** push of metrics plus **REST `/metrics`** bootstrap; dashboard **Chart.js** views for decisions and alert distribution.
5. **Operator-friendly rules UI** — **Rules** page loads config and **`PATCH /rule-config/:ruleType`** updates thresholds, severities, windows, and suspicious-hour bounds.
6. **Built-in transaction simulator** — Guided **scenarios** (high amount, rapid failures, suspicious hours, merchant velocity) and **advanced** editing; uses the same **`POST /events`** contract with **`source: SIMULATOR`**.
7. **DLQ visibility** — **`GET /dlq`** reads recent dead-letter stream entries for debugging.
8. **Health check** — **`GET /health`** pings Redis and Postgres (`SELECT 1`).
9. **IST-aware touches** — Suspicious-hours rule uses **IST**; **`/metrics`** and DLQ responses include **IST-derived timestamps** where implemented.

---

## Rule set (as implemented)

All rules live under `backend/src/rules` and are registered in `rules/index.ts`:

| Rule type | Purpose |
|-----------|---------|
| `VELOCITY_V1` | Card transaction count in a Redis window vs threshold |
| `HIGH_AMOUNT_V1` | Single transaction amount vs threshold |
| `RAPID_FAILURE_V1` | Failed attempts per card in a window (card testing) |
| `SUSPICIOUS_HOURS_V1` | Transactions in configured IST hour range (supports overnight ranges) |
| `MERCHANT_VELOCITY_V1` | Merchant-level velocity vs threshold |

---

## Frontend surface

| Route | Role |
|-------|------|
| `/` | Dashboard: metrics, charts, **Simulate a transaction** |
| `/transactions` | Paginated decisions |
| `/fraud-alerts` | Aggregated alerts |
| `/rules` | View and edit rule parameters |
| `/dlq` | Recent DLQ entries |

Global layout includes **sidebar** + **header** chrome; the **simulator entry point** is on the **Dashboard** page toolbar (not the global header component).

---

## API summary (backend)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/events` | Accept event → Redis stream (202) |
| `GET` | `/health` | Liveness + Redis/Postgres |
| `GET` | `/metrics` | Snapshot of in-process metrics |
| WebSocket | `/ws/metrics` | Streaming `metrics_update` |
| `GET` | `/transactions` | Paginated `transaction_decisions` |
| `GET` | `/fraud-alerts` | Paginated `fraud_alerts` |
| `GET` | `/rule-config` | Current rule configuration map |
| `PATCH` | `/rule-config/:ruleType` | Update rule fields in DB |
| `GET` | `/dlq` | Recent DLQ messages (`limit` query param) |

CORS allows `http://localhost:4200` for the Angular dev server.

---

## PostgreSQL concepts (expected tables)

The code assumes tables including (names from usage): **`processed_transactions`**, **`transaction_decisions`**, **`fraud_alerts`**, **`rule_config`**. **There is no migration or `schema.sql` in this repository** — provisioning is left to the operator unless added later.

---

## How to run (accurate commands)

1. **Infrastructure:** from repo root, `cp .env.example .env`, then `docker compose up -d` (Postgres 15 + Redis 7).
2. **Backend:** `cd backend && npm install && npm run dev` (uses **ts-node-dev** on `src/server.ts`; default port **4000**).
3. **Frontend:** `cd frontend && npm install && npm start` (or `ng serve`) → **http://localhost:4200/**.

The frontend **`package.json`** defines **`start`** → `ng serve`; it does **not** define `npm run dev`.

---

## README vs repository — accuracy notes

The root **README.md** is **largely aligned** with the codebase (architecture, rules, resilience, pages, Docker images, env pattern, backend `npm run dev`).

**Corrections / gaps worth knowing:**

| Topic | README | Repository reality |
|--------|--------|---------------------|
| Frontend dev command | Suggests `npm run dev` or `ng serve` | Use **`npm start`** or **`ng serve`** only |
| Simulator placement | “Dashboard header button” | Button is on the **Dashboard page** header row; the shared **Header** layout has no simulator |
| Hot reload via NOTIFY | Described as working from Postgres | App **`LISTEN rule_config_updated`**, but **no SQL trigger / `NOTIFY` in repo**, and **`PATCH /rule-config` does not notify** — **in-process reload after UI edits may require a DB trigger or code change** |
| Database schema | Implies tables exist | **No checked-in schema/migrations** |

---

## What production systems add (context)

As in the README: multi-region scale, ML/graph features, feature stores, case management, stricter latency SLOs, and hardened security are out of scope for this demo — by design.

---

## License / meta

Backend `package.json` lists **ISC**; treat as demo/portfolio unless you add explicit top-level licensing.

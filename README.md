# Qubetics Native API Service

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

REST API service for the Qubetics native (Cosmos SDK / Tendermint) chain. It serves indexed on-chain data — blocks, transactions, validators, delegators, contracts, tokens, governance proposals and dVPN activity — to the Qubetics explorer and dashboards.

The service reads from the PostgreSQL database populated by the Qubetics **indexer**, and queries the chain's Tendermint RPC directly for live data. Redis is used for response caching and RabbitMQ for messaging.

## Architecture

```
 Qubetics Chain (Tendermint RPC / EVM)
        │                     │
        ▼                     │ live queries
   Indexer ──► PostgreSQL ◄───┤ (primary + read replica)
                    │         │
                    ▼         ▼
           Native API Service (Express) ──► Redis (cache)
                    │                  └──► RabbitMQ
                    ▼
          Explorer / Dashboard clients
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 18+, TypeScript |
| Framework | Express, Helmet, CORS, Joi |
| Database | PostgreSQL via Prisma ORM (read-replica extension) |
| Cache / Queue | Redis, RabbitMQ (amqplib) |
| Chain client | CosmJS (Stargate, Tendermint RPC) |
| Docs | Swagger UI |

## Prerequisites

- Node.js **18+** and npm
- PostgreSQL 14+ (already populated by the Qubetics indexer)
- Redis 6+
- RabbitMQ 3+
- Access to a Qubetics Tendermint RPC endpoint

## Getting Started

```bash
# 1. Clone and install
git clone <repository-url>
cd native-api-service
npm install

# 2. Configure environment
cp .env.example .env
# edit .env (see Configuration below)

# 3. Generate the Prisma client
npm run generate:prisma

# 4. Run in development (hot reload)
npm run dev
```

Health check: `GET http://localhost:<PORT>/qubetics/status` → `{"message":"Up and Running"}`

> The database schema is owned by the indexer. Only run `npm run migrate:dev` against a local/dev database.

## Configuration

Environment files are selected by `NODE_ENV`: `.env` (local/dev), `.env.test`, `.env.stag`, `.env.prod`.

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `local` \| `dev` \| `test` \| `staging` \| `production` |
| `PORT` | HTTP port (default `3146`) |
| `DATABASE_URL` | PostgreSQL primary connection string |
| `DATABASE_REPLICA_URL` | PostgreSQL read-replica connection string |
| `REDIS_HOST`, `REDIS_PORT` | Redis connection |
| `API_REDIS_EXPIRY` | Cache TTL (seconds) |
| `RABITMQ_URL` | RabbitMQ connection URL |
| `NATIVE_TENDERMINT_HTTP_HOST` | Tendermint RPC endpoint |
| `EVM_API_BASE_URL` | EVM API base URL |
| `ADDRESS_PREFIX` | Bech32 address prefix |
| `SWAGGER_HTTP_HOST` | Host shown in Swagger docs |
| `APPLY_ENCRYPTION`, `SECRET_KEY`, `SALT_VALUE`, `PUBLIC_KEY`, `PRIVATE_KEY` | Payload encryption settings |
| `COIN_MARKET_API_PATH`, `COIN_MARKET_API_KEY` | CoinMarketCap price feed |
| `TOKEN_CURRENCY`, `TOKEN_SYMBOL`, `INITIAL_SUPPLY` | Token metadata |
| `VALIDATORS`, `EXCLUDING_VALIDATORS` | Validator include/exclude lists |
| `TTL_TIME_FOR_REWARDS` | Rewards cache TTL |
| `NODE_INFO_URL`, `NODE_IP`, `LOCATION_API_URL` | Node info / geo-location |
| `GOOGLE_RECAPTCHA_URL`, `REACT_APP_RECAPTCHA_SITE_KEY` | reCAPTCHA |
| `PROJECT_NAME` | Project identifier |

Never commit real `.env` files or secrets.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon (ts-node) |
| `npm run build:prod` | Compile TypeScript to `build/` |
| `npm run start:production` | Run compiled build with `NODE_ENV=production` |
| `npm run start:staging` / `start:test` | Run compiled build for staging / test |
| `npm run generate:prisma` | Generate Prisma client |
| `npm run db:studio` | Open Prisma Studio |
| `npm run lint` / `lint-fix` / `pretty` | Lint and format |
| `npm test` | Run Jest tests with coverage |

## API

Base path: `/qubetics`  ·  Swagger UI: `/api/docs`

| Route | Resource |
| --- | --- |
| `/status` | Health check |
| `/blocks` | Blocks |
| `/transactions` | Transactions |
| `/validators` | Validators, uptime, APR |
| `/delegators` | Delegations and rewards |
| `/contracts` | Smart contracts |
| `/tokens` | Tokens and holders |
| `/proposals` | Governance proposals and votes |
| `/explorer` | Search, stats, supply, user data |
| `/node` | Node information |
| `/dvpn` | dVPN transactions |
| `/session` | Signed message / session |

## Project Structure

```
src/
├── App.ts            # Express app, middleware, Swagger
├── server.ts         # HTTP server bootstrap
├── routes.ts         # Route registration
├── environments/     # Env loading and typing
├── module/<name>/    # controller · service · validation per resource
├── service/          # Redis, RabbitMQ, response helpers
├── helper/           # Cosmos client, APR, metrics, GeoIP, rate limiter
├── lib/              # Prisma DB client, logger
└── data/             # GeoLite2 database
prisma/schema.prisma  # Database schema (shared with indexer)
```

## Docker

```bash
docker build -t qubetics-native-api .
docker run -d --env-file .env -p 7400:7400 -e PORT=7400 qubetics-native-api
```

Kubernetes manifests and CI workflows live in `.github/workflows/`; see also `deployment.yaml` and `.gitlab-ci.yml`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities per [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE). © 2026 Qubetics.

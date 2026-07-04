# Gatus — Uptime Monitoring

Self-hosted uptime monitoring for all Monaliens backend services using [Gatus](https://github.com/TwiN/gatus). Runs as a single Docker container and exposes a status page with historical uptime data backed by SQLite.

---

## What It Monitors

Endpoints are organised into four groups defined in `config/config.yaml`:

| Group | Services |
|-------|----------|
| **Core** | API (`api.monaliens.xyz`), Website (`monaliens.xyz`) |
| **Games** | Mines, Coin Flip, Dice, HiLo, Blackjack, Limbo, Keno |
| **Infrastructure** | Indexer API, RPC Sync Status |
| **Deep Health** | Per-service deep checks: MongoDB, event listener, relayer wallet |

### Shallow health checks (30s interval)
Each game backend exposes `GET /api/health`. Gatus asserts:
- HTTP `200`
- Response time under 5 seconds

### Deep health checks (60s interval)
Each service also exposes `GET /api/health/deep`, which probes internal dependencies (MongoDB connection, RPC node reachability, event listener sync lag, relayer wallet balance). Gatus asserts:
- HTTP `200`
- Response body field `success == true`

---

## Alerting

Alerts fire on Telegram after **3 consecutive failures** and auto-resolve after **2 consecutive successes**. Two Telegram recipients are configured — one via the built-in `telegram` alerter and one via the `custom` webhook alerter.

To update recipients, edit the `alerting` block in `config/config.yaml`.

The Telegram bot token and chat IDs in the config are sensitive. In a production fork, replace them with environment variable references using [Gatus's `$ENV_VAR` syntax](https://github.com/TwiN/gatus#using-environment-variables).

---

## Running

```bash
docker-compose up -d
```

The dashboard is available at `http://localhost:3322` (host port 3322 → container port 8080).

Uptime history (SQLite) is persisted in the `./data` volume so restarts do not reset history.

---

## Configuration

All monitoring is defined in `config/config.yaml`. To add a new endpoint:

```yaml
endpoints:
  - name: My New Service
    group: Games
    url: "https://your-service.example.com/api/health"
    interval: 30s
    alerts:
      - type: telegram
      - type: custom
    conditions:
      - "[STATUS] == 200"
      - "[RESPONSE_TIME] < 5000"
```

Changes take effect on container restart:

```bash
docker-compose restart gatus
```

---

## File Layout

```
config/
  config.yaml         # All endpoint definitions and alerting config
docker-compose.yml    # Single-container compose (image: twinproduction/gatus:latest)
data/                 # SQLite uptime DB — created at runtime, gitignored
```

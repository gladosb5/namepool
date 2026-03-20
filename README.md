# Namepool

**Namepool** is a mempool visualizer, explorer, and API service for the [Namecoin](https://namecoin.org) community, running at [namepool.bit](https://namepool.bit).

This project is an open-source fork of [mempool.space](https://github.com/mempool/mempool), adapted for the Namecoin blockchain. It is built and operated for the benefit of the Namecoin community.

## What It Does

- Real-time mempool visualization and transaction tracking for Namecoin
- Block explorer with fee estimates and mining dashboards
- NMC/USD historical price charts
- Full REST API and WebSocket interface
- Name operation tracking (Namecoin `.bit` domain registrations and updates)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, TypeScript, Express |
| Frontend | Angular SPA (40+ languages, SSR) |
| Database | MariaDB 10.5+ |
| Cache | Redis |
| Blockchain | Namecoin Core (RPC) |
| Performance | Rust/WASM block template computation |
| Deployment | Self-hosted (Linux/FreeBSD + Nginx) |

## Installation

For setup instructions, see:

- [backend/README.md](backend/README.md) — backend setup
- [frontend/README.md](frontend/README.md) — frontend setup
- [production/README.md](production/README.md) — advanced production deployment

## Prerequisites

- [Namecoin Core](https://namecoin.org) (fully synced)
- MariaDB 10.5+
- Redis
- Node.js 20.x / npm 9.x+
- Rust (for backend build)
- (Optional) An Electrum Server for address lookups ([romanz/electrs](https://github.com/romanz/electrs), [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum), or [Blockstream/electrs](https://github.com/Blockstream/electrs))

## Contributing

Pull requests are welcome. Please open an issue first to discuss major changes.

## License

[MIT](LICENSE)

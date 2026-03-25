# Namepool

**Namepool** is a mempool visualizer, explorer, and API service for the [Namecoin](https://namecoin.org) community, running at [namepool.bit](https://namepool.bit).

This project is an open-source fork of [mempool.space](https://github.com/mempool/mempool), adapted for the Namecoin blockchain. It is built and operated for the benefit of the Namecoin community.

## What It Does

- Real-time mempool visualization and transaction tracking for Namecoin
- Block explorer with fee estimates and mining dashboards
- NMC/USD historical price charts
- Full REST API and WebSocket interface
- Name operation tracking (Namecoin `.bit` domain registrations and updates)

## Stack

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
- [docker/README.md](docker/README.md) — local Docker setup
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

## Supported Versions

Namepool does not currently maintain multiple release branches. Security fixes are applied to the default branch and included in the next deployment/release.

## Reporting a Vulnerability

Please **do not** open a public issue for **suspected** vulnerabilities.

Instead, report vulnerabilities privately by emailing:

- **namepool+gladosb5iscool@protonmail.com**

Then just put in your issue, as long as I can understand it and some common sense then you can format it in anyway you like.

## Disclosure Process

1. We acknowledge receipt as quickly as possible.
2. We validate and triage the report.
3. We coordinate a fix and deployment.
4. We publicly disclose details after remediation when appropriate.

We appreciate responsible disclosure and will credit researchers with 0.5 NMC (if desired and if it's available) after a fix is available.

## License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL v3.0). See [LICENSE](LICENSE).

The license also includes a trademark notice: use of project/contributor trademarks, service marks, logos, and trade names is **not** granted by the copyright license.

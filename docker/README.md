# Docker Installation

This directory contains the local-only Docker setup for Namepool.

The application images are built from this repository as `namepool/backend:local` and `namepool/frontend:local`. They are not published to Docker Hub. Only base images such as `mariadb`, `node`, `nginx`, and `rust` are pulled from Docker Hub during the build.

If you are deploying your own instance of Namepool, note that these containers only cover the frontend, backend, and MariaDB. You still need to run and configure Namecoin Core separately, plus an Electrum Server if you want address lookups.

Jump to a section in this doc:
- [Quick Start with Compose](#quick-start-with-compose)
- [Build Images Locally](#build-images-locally)
- [Create a Docker Network](#create-a-docker-network)
- [Configure with Namecoin Core Only](#configure-with-namecoin-core-only)
- [Configure with Namecoin Core + Electrum Server](#configure-with-namecoin-core--electrum-server)
- [Further Configuration](#further-configuration)

## Quick Start with Compose

Build and run the local Namepool images directly from this repository:

```bash
git clone https://github.com/gladosb5/namepool
cd namepool/docker
docker compose up --build -d
```

This compose file builds `namepool/backend:local` and `namepool/frontend:local` locally before starting the stack.

The default backend container configuration assumes your host machine runs `namecoind` with:

```ini
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

The default compose file also assumes Namecoin Core is reachable at `172.27.0.1:8332`. If your setup is different, edit the environment variables in `docker-compose.yml` before starting the stack.

_Note: address lookups require an Electrum Server and will not work with the default `MEMPOOL_BACKEND=none` compose configuration._

## Build Images Locally

If you prefer to build the images without Compose:

```bash
git clone https://github.com/gladosb5/namepool
cd namepool
docker build -t namepool/backend:local -f docker/backend/Dockerfile .
docker build -t namepool/frontend:local -f docker/frontend/Dockerfile .
```

## Create a Docker Network

Create a user-defined Docker network so the frontend container can reach the backend container by name:

```bash
docker network create namepool-net
```

## Configure with Namecoin Core Only

_Note: address lookups require an Electrum Server and will not work with this configuration. [Add an Electrum Server](#configure-with-namecoin-core--electrum-server) to your backend for full functionality._

If you want to run the locally built containers manually instead of using Compose, start the backend with your Namecoin Core settings:

```bash
docker run -d --name namepool-backend \
  --restart unless-stopped \
  --network namepool-net \
  -p 8999:8999 \
  -e MEMPOOL_BACKEND=none \
  -e CORE_RPC_HOST=172.27.0.1 \
  -e CORE_RPC_PORT=8332 \
  -e CORE_RPC_USERNAME=customuser \
  -e CORE_RPC_PASSWORD=custompassword \
  -e CORE_RPC_TIMEOUT=60000 \
  namepool/backend:local
```

The IP address in the example above refers to Docker's default gateway IP address so the container can reach a `namecoind` instance running on the host machine. If your setup is different, update it accordingly.

Make sure `namecoind` is running and fully synced.

Then start the frontend container and point it at the backend container:

```bash
docker run -d --name namepool-frontend \
  --restart unless-stopped \
  --network namepool-net \
  -p 80:8080 \
  -e BACKEND_MAINNET_HTTP_HOST=namepool-backend \
  -e BACKEND_MAINNET_HTTP_PORT=8999 \
  namepool/frontend:local
```

Your Namepool instance should be running at http://localhost. Graphs will populate as new transactions are detected.

## Configure with Namecoin Core + Electrum Server

First, configure `namecoind` as specified above, and make sure your Electrum Server is running and synced. See [this FAQ](https://namepool.bit/docs/faq#address-lookup-issues) if you need help picking an Electrum Server implementation.

When starting `namepool/backend:local`, set the following variables so Namepool can connect to your Electrum Server:

```bash
docker run -d --name namepool-backend \
  --restart unless-stopped \
  --network namepool-net \
  -p 8999:8999 \
  -e MEMPOOL_BACKEND=electrum \
  -e CORE_RPC_HOST=172.27.0.1 \
  -e CORE_RPC_PORT=8332 \
  -e CORE_RPC_USERNAME=mempool \
  -e CORE_RPC_PASSWORD=mempool \
  -e ELECTRUM_HOST=172.27.0.1 \
  -e ELECTRUM_PORT=50002 \
  -e ELECTRUM_TLS_ENABLED=false \
  namepool/backend:local
```

Eligible values for `MEMPOOL_BACKEND`:
- `"electrum"` if you're using [romanz/electrs](https://github.com/romanz/electrs) or [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
- `"esplora"` if you're using [Blockstream/electrs](https://github.com/Blockstream/electrs)
- `"none"` if you're not using an Electrum Server

## Further Configuration

See the [backend README](../backend/README.md) for a full list of configuration options.

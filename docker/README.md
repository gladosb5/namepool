# Docker Installation

This directory contains the Dockerfiles and helper scripts used to build and run Namepool's backend and frontend containers.

> **Important:** There is no Compose file in this directory. Build and run the Namepool images directly with `docker build` and `docker run` as shown below.

If you are looking to use Docker to deploy your own instance of Namepool, note that the containers only cover Namepool's frontend and backend. You will still need to deploy and configure Namecoin Core and an Electrum Server separately, along with any other utilities specific to your use case (e.g., a reverse proxy, etc.).

Jump to a section in this doc:
- [Build Images Locally](#build-images-locally)
- [Create a Docker Network](#create-a-docker-network)
- [Configure with Namecoin Core Only](#configure-with-namecoin-core-only)
- [Configure with Namecoin Core + Electrum Server](#configure-with-namecoin-core--electrum-server)
- [Further Configuration](#further-configuration)

## Build Images Locally

Build the Namecoin-specific images from source:

```bash
git clone https://github.com/gladosb5/namepool
cd namepool
latestrelease=$(curl -s https://api.github.com/repos/gladosb5/namepool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
cd docker
docker build -t namepool/backend:latest -f backend/Dockerfile ..
docker build -t namepool/frontend:latest -f frontend/Dockerfile ..
```

These commands already produce the correct Namepool images (`namepool/backend:latest` and `namepool/frontend:latest`), so no image replacement step is required.

## Create a Docker Network

Create a user-defined Docker network so the frontend container can reach the backend container by name:

```bash
docker network create namepool-net
```

## Configure with Namecoin Core Only

_Note: address lookups require an Electrum Server and will not work with this configuration. [Add an Electrum Server](#configure-with-namecoin-core--electrum-server) to your backend for full functionality._

The default Docker configuration assumes you have the following configuration in your `namecoin.conf` file:

```ini
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

If you want to use different credentials, pass them as environment variables when starting the backend container:

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
  namepool/backend:latest
```

The IP address in the example above refers to Docker's default gateway IP address so that the container can reach the `namecoind` instance running on the host machine. If your setup is different, update it accordingly.

Make sure `namecoind` is running and fully synced.

Then start the frontend container and point it at the backend container:

```bash
docker run -d --name namepool-frontend \
  --restart unless-stopped \
  --network namepool-net \
  -p 80:8080 \
  -e BACKEND_MAINNET_HTTP_HOST=namepool-backend \
  -e BACKEND_MAINNET_HTTP_PORT=8999 \
  namepool/frontend:latest
```

Your Namepool instance should be running at http://localhost. Graphs will populate as new transactions are detected.

## Configure with Namecoin Core + Electrum Server

First, configure `namecoind` as specified above, and make sure your Electrum Server is running and synced. See [this FAQ](https://namepool.bit/docs/faq#address-lookup-issues) if you need help picking an Electrum Server implementation.

When starting `namepool/backend:latest`, set the following variables so Namepool can connect to your Electrum Server:

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
  namepool/backend:latest
```

Eligible values for `MEMPOOL_BACKEND`:
  - `"electrum"` if you're using [romanz/electrs](https://github.com/romanz/electrs) or [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
  - `"esplora"` if you're using [Blockstream/electrs](https://github.com/Blockstream/electrs)
  - `"none"` if you're not using an Electrum Server

## Further Configuration

See the [backend README](../backend/README.md) for a full list of configuration options.

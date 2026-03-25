# Docker Installation

This directory contains the Dockerfiles used to build the Namepool images, as well as a `docker-compose.yml` to configure environment variables and other settings.

> **Important:** The `mempool/frontend` and `mempool/backend` images referenced in `docker-compose.yml` are from the upstream mempool.space project and are **not compatible with Namecoin out of the box**. You must build the images locally from this repository before running. See build instructions below.

If you are looking to use Docker to deploy your own instance of Namepool, note that the containers only cover Namepool's frontend and backend. You will still need to deploy and configure Namecoin Core and an Electrum Server separately, along with any other utilities specific to your use case (e.g., a reverse proxy, etc.).

Jump to a section in this doc:
- [Build Images Locally](#build-images-locally)
- [Configure with Namecoin Core Only](#configure-with-namecoin-core-only)
- [Configure with Namecoin Core + Electrum Server](#configure-with-namecoin-core--electrum-server)
- [Further Configuration](#further-configuration)

## Build Images Locally

Before running `docker-compose up`, build the Namecoin-specific images from source:

```bash
git clone https://github.com/gladosb5/namepool
cd namepool
latestrelease=$(curl -s https://api.github.com/repos/gladosb5/namepool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
cd docker
docker build -t namepool/backend:latest -f backend/Dockerfile ..
docker build -t namepool/frontend:latest -f frontend/Dockerfile ..
```

Then update `docker-compose.yml` to use `namepool/frontend:latest` and `namepool/backend:latest` instead of `mempool/frontend:latest` and `mempool/backend:latest`.

## Configure with Namecoin Core Only

_Note: address lookups require an Electrum Server and will not work with this configuration. [Add an Electrum Server](#configure-with-namecoin-core--electrum-server) to your backend for full functionality._

The default Docker configuration assumes you have the following configuration in your `namecoin.conf` file:

```ini
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

If you want to use different credentials, specify them in the `docker-compose.yml` file:

```yaml
  api:
    environment:
      MEMPOOL_BACKEND: "none"
      CORE_RPC_HOST: "172.27.0.1"
      CORE_RPC_PORT: "8332"
      CORE_RPC_USERNAME: "customuser"
      CORE_RPC_PASSWORD: "custompassword"
      CORE_RPC_TIMEOUT: "60000"
```

The IP address in the example above refers to Docker's default gateway IP address so that the container can reach the `namecoind` instance running on the host machine. If your setup is different, update it accordingly.

Make sure `namecoind` is running and fully synced.

Now, run:

```bash
docker-compose up
```

Your Namepool instance should be running at http://localhost. Graphs will populate as new transactions are detected.

## Configure with Namecoin Core + Electrum Server

First, configure `namecoind` as specified above, and make sure your Electrum Server is running and synced. See [this FAQ](https://namepool.bit/docs/faq#address-lookup-issues) if you need help picking an Electrum Server implementation.

Then, set the following variables in `docker-compose.yml` so Namepool can connect to your Electrum Server:

```yaml
  api:
    environment:
      MEMPOOL_BACKEND: "electrum"
      ELECTRUM_HOST: "172.27.0.1"
      ELECTRUM_PORT: "50002"
      ELECTRUM_TLS_ENABLED: "false"
```

Eligible values for `MEMPOOL_BACKEND`:
  - `"electrum"` if you're using [romanz/electrs](https://github.com/romanz/electrs) or [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
  - `"esplora"` if you're using [Blockstream/electrs](https://github.com/Blockstream/electrs)
  - `"none"` if you're not using an Electrum Server

## Further Configuration

See the [backend README](../backend/README.md) for a full list of configuration options.

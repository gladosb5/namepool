# Namepool Backend

These instructions are mostly intended for developers.

If you choose to use these instructions for a production setup, be aware that you will still probably need to do additional configuration for your specific OS, environment, and use case.

See other ways to set up Namepool in the [main README](../README.md#installation).

Jump to a section in this doc:
- [Set Up the Backend](#setup)
- [Development Tips](#development-tips)

## Setup

### 1. Clone Namepool Repository

Get the latest Namepool code:

```
git clone https://github.com/gladosb5/namepool
cd namepool
```

Check out the latest release:

```
latestrelease=$(curl -s https://api.github.com/repos/gladosb5/namepool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
```

### 2. Configure Namecoin Core

Turn on `txindex`, enable RPC, and set RPC credentials in `namecoin.conf`:

```
txindex=1
server=1
rpcuser=namepool
rpcpassword=namepool
```

### 3. Configure Electrum Server

[Pick an Electrum Server implementation](https://namepool.bit/docs/faq#address-lookup-issues), configure it, and make sure it's synced.

**This step is optional.** You can run Namepool without an Electrum Server, but address lookups will be disabled.

### 4. Configure MariaDB

_Namepool requires MariaDB v10.5 or later. If you already have MySQL installed, make sure to migrate any existing databases **before** installing MariaDB._

Get MariaDB from your operating system's package manager:

```
# Debian, Ubuntu, etc.
apt-get install mariadb-server mariadb-client

# macOS
brew install mariadb
mysql.server start
```

Create a database and grant privileges:

```
MariaDB [(none)]> create database mempool;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
Query OK, 0 rows affected (0.00 sec)
```

### 5. Prepare Namepool Backend

#### Build

_Make sure to use Node.js 20.x and npm 9.x or newer._

_The build process requires [Rust](https://www.rust-lang.org/tools/install) to be installed._

Install dependencies with `npm` and build the backend:

```
cd backend
npm install --no-install-links
npm run build
```

#### Configure

In the backend folder, make a copy of the sample config file:

```
cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` as needed.

In particular, make sure:
- the correct Namecoin Core RPC credentials are specified in `CORE_RPC`
- the correct `BACKEND` is specified in `MEMPOOL`:
  - `"electrum"` if you're using [romanz/electrs](https://github.com/romanz/electrs) or [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
  - `"esplora"` if you're using [Blockstream/electrs](https://github.com/Blockstream/electrs)
  - `"none"` if you're not using an Electrum Server

#### Run

```
npm run start
```

## Development Tips

### DB Reset

To reset the Namepool database, run:

```
npm run reset-database
```

### Regtest Mining

When running the backend in regtest mode, you can use the following command to generate blocks:

```
npm run regtest:mine
```

### Testing

```
npm run test
```

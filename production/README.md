# Deploying a Production Instance

These instructions are for setting up a serious production Namepool instance for Namecoin (mainnet, testnet, signet).

> **Warning:** This setup is not for home users. It is intended for advanced, custom production environments.

## Server Hardware

A production Namepool instance is resource-intensive due to Namecoin Core, Electrum indexing, and the backend processing load.

Recommended minimum specs:

- **CPU:** 20-core (more is better)
- **RAM:** 64 GB (more is better)
- **Storage:** 4 TB SSD (NVMe preferred)

### HDD vs SSD vs NVMe

A fast NVMe SSD is strongly recommended. Spinning HDDs will result in very slow initial sync and poor performance.

## Operating System

The namepool.bit production instance runs **FreeBSD 13** with ZFS root and ARC cache for maximum performance. Linux works too, but ZFS on FreeBSD is the recommended setup for production.

### Filesystem Layout

For maximum performance, use 2x NVMe SSDs in a ZFS RAID-0 (stripe) pool with generous RAM for the ARC L2 cache.

Example ZFS pool layout:

```
% zpool list -v
NAME        SIZE  ALLOC   FREE  CHECKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
nvm        3.62T  1.25T  2.38T          -         -     2%    34%  1.00x    ONLINE  -
  nvd0p3   1.81T   629G  1.20T          -         -     2%  33.9%      -  ONLINE
  nvd1p3   1.81T   646G  1.18T          -         -     2%  34.8%      -  ONLINE
```

Recommended separate ZFS datasets per data directory:

```
Filesystem                              Size    Used   Avail Capacity  Mounted on
nvm/namecoin                            766G    648M    765G      0%    /namecoin
nvm/namecoin/blocks                    1.1T    375G    765G     33%    /namecoin/blocks
nvm/namecoin/chainstate                770G    4.5G    765G      1%    /namecoin/chainstate
nvm/namecoin/electrs                   772G    7.3G    765G      1%    /namecoin/electrs
nvm/namecoin/indexes                   799G     34G    765G      4%    /namecoin/indexes
nvm/namecoin/testnet3                  765G    5.0M    765G      0%    /namecoin/testnet3
nvm/namecoin/testnet3/blocks           786G     21G    765G      3%    /namecoin/testnet3/blocks
nvm/namecoin/testnet3/chainstate       766G    1.1G    765G      0%    /namecoin/testnet3/chainstate
nvm/namecoin/testnet3/indexes          768G    2.9G    765G      0%    /namecoin/testnet3/indexes
```

## Install

### 1. Install Namecoin Core

Follow the [official Namecoin Core installation instructions](https://namecoin.org/).

Configure `namecoin.conf`:

```
txindex=1
server=1
rpcuser=namepool
rpcpassword=namepool
```

Start and fully sync `namecoind` before proceeding.

### 2. Install Electrum Server

Follow the [mempool/electrs installation instructions](https://github.com/mempool/electrs) and allow it to fully sync against Namecoin Core.

### 3. Install MariaDB

```
pkg install mariadb105-server
sysrc mysql_enable=YES
service mysql-server start
```

Create a database and grant privileges:

```
MariaDB [(none)]> create database mempool;
MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
```

### 4. Install Namepool

```
git clone https://github.com/gladosb5/namepool
cd namepool
latestrelease=$(curl -s https://api.github.com/repos/gladosb5/namepool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
cd backend
npm install --no-install-links
npm run build
cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` for your environment (RPC credentials, Electrum host, etc.).

```
cd ../frontend
npm install
npm run build
```

### 5. Set Up a Web Server

Sample nginx configuration files are available at the root of the repository. Adjust them for your environment and install them in your web server config directory.

### 6. Start Everything

```
service namecoind start
service electrs start
service mysql-server start
service namepool-backend start
service nginx start
```

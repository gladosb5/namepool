# Namepool Frontend

Disclaimer: this frontend is a fork of the open-source project behind mempool.space, and all credits belong to the mempool.space project and its contributors.

You can build and run the Namepool frontend and proxy to the production Namepool backend (for easier frontend development), or you can connect it to your own backend for a full Namepool development instance, custom deployment, etc.

Jump to a section in this doc:
- [Quick Setup for Frontend Development](#quick-setup-for-frontend-development)
- [Manual Frontend Setup](#manual-setup)
- [Translations](#translations-transifex-project)

## Quick Setup for Frontend Development

If you want to quickly improve the UI, fix typos, or make other updates that don't require any backend changes, you don't need to set up an entire backend—you can simply run the Namepool frontend locally and proxy to the namepool.bit backend.

### 1. Clone Namepool Repository

Get the latest Namepool code:

```
git clone https://github.com/namepool/namepool
cd namepool/frontend
```

### 2. Specify Website

The same frontend codebase is used for https://namepool.bit and https://liquid.network.

Configure the frontend for the site you want by running the corresponding command:

```
$ npm run config:defaults:namepool
$ npm run config:defaults:liquid
```

### 3. Run the Frontend

_Make sure to use Node.js 20.x and npm 9.x or newer._

Install project dependencies and run the frontend server:

```
$ npm install
$ npm run serve:local-prod
```

The frontend will be available at http://localhost:4200/ and all API requests will be proxied to the production server at https://namepool.bit.

### 4. Test

After making your changes, you can run our end-to-end automation suite and check for possible regressions.

Headless:

```
$ npm run config:defaults:namepool && npm run cypress:run
```

Interactive:

```
$ npm run config:defaults:namepool && npm run cypress:open
```

This will open the Cypress test runner, where you can select any of the test files to run.

If all tests are green, submit your PR, and it will be reviewed by someone on the team as soon as possible.

## Manual Setup

Set up the [Namepool backend](../backend/) first, if you haven't already.

### 1. Build the Frontend

_Make sure to use Node.js 20.x and npm 9.x or newer._

Build the frontend:

```
cd frontend
npm install
npm run build
```

### 2. Run the Frontend

#### Development

To run your local Namepool frontend with your local Namepool backend:

```
npm run serve
```

#### Production

The `npm run build` command from step 1 above should have generated a `dist` directory. Put the contents of `dist/` onto your web server.

You will probably want to set up a reverse proxy, TLS, etc. There are sample nginx configuration files in the top level of the repository for reference, but note that support for such tasks is outside the scope of this project.

## Translations: Transifex Project

The Namepool frontend strings are localized into 20+ locales:
https://www.transifex.com/namepool/namepool/dashboard/

### Translators

* Arabic @baro0k
* Czech @pixelmade2
* Danish @pierrevendelboe
* German @Emzy
* English (default)
* Spanish @maxhodler @bisqes
* Persian @techmix
* French @Bayernatoor
* Korean @kcalvinalvinn @sogoagain
* Italian @HodlBits
* Lithuanian @eimze21
* Hebrew @rapidlab309
* Georgian @wyd_idk
* Hungarian @btcdragonlord
* Dutch @m__btc
* Japanese @wiz @japananon
* Norwegian @T82771355
* Polish @maciejsoltysiak
* Portugese @jgcastro1985
* Slovenian @thepkbadger
* Finnish
* Swedish @softsimon_
* Thai @Gusb3ll
* Turkish @stackmore
* Ukrainian @volbil
* Vietnamese
* Chinese @wdljt
* Russian @TonyCrusoe @Bitconan
* Romanian @mirceavesa
* Macedonian @SkechBoy
* Nepalese @kebinm

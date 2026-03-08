# Namepool Frontend

Disclaimer: this frontend is an independent Namecoin community fork and is not affiliated with or endorsed by any third-party explorer operator.

You can build and run the Namepool frontend and proxy to the production Namepool backend (for easier frontend development), or connect it to your own self-hosted backend for a full development instance or custom deployment.

Jump to a section in this doc:
- [Quick Setup for Frontend Development](#quick-setup-for-frontend-development)
- [Manual Frontend Setup](#manual-setup)
- [Translations](#translations)

## Quick Setup for Frontend Development

If you want to quickly improve the UI, fix typos, or make other updates that don't require any backend changes, you don't need to set up an entire backend — you can run the Namepool frontend locally and proxy API requests to your own local backend or a self-hosted instance.

### 1. Clone Namepool Repository

Get the latest Namepool code:

```
git clone https://github.com/gladosb5/namepool
cd namepool/frontend
```

### 2. Specify Website

The same frontend codebase supports multiple network configurations. Configure it for the site you want:

```
$ npm run config:defaults:namepool
```

### 3. Run the Frontend

_Make sure to use Node.js 20.x and npm 9.x or newer._

Install project dependencies and run the frontend server:

```
$ npm install
$ npm run serve:local-prod
```

The frontend will be available at http://localhost:4200/. API requests will be proxied to your local backend by default.

### 4. Test

After making your changes, run the end-to-end test suite to check for regressions.

Headless:

```
$ npm run config:defaults:namepool && npm run cypress:run
```

Interactive:

```
$ npm run config:defaults:namepool && npm run cypress:open
```

This will open the Cypress test runner where you can select test files to run.

If all tests pass, submit your PR and it will be reviewed by the team as soon as possible.

## Manual Setup

Set up the [Namepool backend](../backend/README.md) first, if you haven't already.

### 1. Build the Frontend

_Make sure to use Node.js 20.x and npm 9.x or newer._

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

The `npm run build` command generates a `dist/` directory. Place the contents of `dist/` on your web server.

You will likely want to configure a reverse proxy, TLS, etc. Sample nginx configuration files are available at the top level of the repository for reference.

## Translations

The Namepool frontend strings are available for community translation. If you'd like to contribute translations, please open an issue or pull request in this repository.

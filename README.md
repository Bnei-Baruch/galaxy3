# Galaxy3

Galaxy3 is a real-time virtual classroom and WebRTC streaming platform built for Bnei Baruch. It connects users to live video rooms via Janus WebRTC gateway, with MQTT for real-time messaging and Keycloak for authentication.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js** (v18+ recommended)
- **Yarn** package manager

## Installation

Clone the repository and install the dependencies:

```bash
yarn install
```

## Running Locally (Development)

The project contains multiple applications that share the same codebase. You can run a specific application locally using the provided yarn scripts. By default, the development server runs on `http://localhost:3000`.

| Application | Command | Description |
|-------------|---------|-------------|
| **Virtual** | `yarn start:virtual` | Main user-facing virtual classroom (Default) |
| **Admin** | `yarn start:admin` | Admin management interface |
| **Shidur** | `yarn start:shidur` | Director/shidur control panel |
| **AudioOut**| `yarn start:audioout`| Audio output service |
| **VideoOut**| `yarn start:videoout`| Video output / question output service |
| **QstOut** | `yarn start:qstout` | Question output service |
| **WebOut** | `yarn start:webout` | Web output service |

*Note: If you just run `yarn start`, it will default to the Virtual app.*

## Building for Production

To build a specific application for production, use the corresponding build script. This will bundle the React application in production mode and optimize the build for the best performance.

| Application | Command |
|-------------|---------|
| **Virtual** | `yarn build:virtual` |
| **Admin** | `yarn build:admin` |
| **Shidur** | `yarn build:shidur` |
| **AudioOut**| `yarn build:audioout`|
| **VideoOut**| `yarn build:videoout`|
| **QstOut** | `yarn build:qstout` |
| **WebOut** | `yarn build:webout` |

*Note: If you just run `yarn build`, it will default to building the Virtual app.*

## Build Artifacts

Once the build process completes successfully, all production-ready artifacts will be generated in the **`build/`** directory at the root of the project. The `build/` folder is overwritten on every build (the `clean: true` option in webpack output is enabled), so only the most recently built application is present at any given time.

The `build/` directory contains:
- `index.html` (The main HTML file)
- `static/js/` (Bundled JavaScript files)
- `static/css/` (Bundled CSS files)
- `static/media/` (Images, fonts, and other static assets)

If you need to build several applications side by side (without overwriting), build them one at a time and copy the output elsewhere between runs.

You can serve the contents of the `build/` directory using any static file server (like Nginx, Apache, or `serve`).

## Environment Configuration

The application relies on environment variables for configuration (e.g., URLs for MQTT, Janus, Keycloak auth, API backends). All React environment variables must be prefixed with `REACT_APP_`.

### Default behavior

By default, both `yarn start` and `yarn build` load **only `.env`** from the project root. No automatic per-mode files (no implicit `.env.development` / `.env.production`).

### Loading an additional overlay file

To layer another file on top of `.env`, set `REACT_APP_ENV` to its suffix. The file `.env.<suffix>` is then loaded and its keys override those from `.env`.

```bash
# Use .env + .env.local
REACT_APP_ENV=local yarn start

# Use .env + .env.dev
REACT_APP_ENV=dev yarn build

# Use .env + .env.prod
REACT_APP_ENV=prod yarn build:virtual

# Use .env + .env.rus (or any other custom suffix you create)
REACT_APP_ENV=rus yarn start
```

If `REACT_APP_ENV` is set but the corresponding file is missing, webpack prints a warning and continues with just `.env`.

### Priority order (lowest to highest)

1. `.env`
2. `.env.<REACT_APP_ENV>` (if `REACT_APP_ENV` is set and the file exists)
3. `REACT_APP_*` variables from the shell environment (e.g. `REACT_APP_FOO=bar yarn build`)

Higher-priority sources override the same keys from lower-priority ones.

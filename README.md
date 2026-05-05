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

The application relies on environment variables for configuration (e.g., URLs for MQTT, Janus, Keycloak auth, API backends). 
All React environment variables must be prefixed with `REACT_APP_`.

You can create different `.env` files based on your environment needs:
- `.env` (Default, lowest priority)
- `.env.development` (Loaded when running `yarn start`)
- `.env.production` (Loaded when running `yarn build`)
- `.env.staging` (Loaded if you set `REACT_APP_ENV=dev`)

Alternatively, you can just maintain a single `.env` file in the root directory and comment/uncomment variables as needed.

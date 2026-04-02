# Taki CLI

Taki is a terminal dashboard for running multiple local services in one place.

It helps you:

- start and monitor many services from one command
- see logs in a single UI
- restart a focused service quickly
- scaffold `taki.json` with an interactive wizard

## Install

### Global

```bash
npm install -g @kwiruu/taki-cli
```

### Local dev

```bash
npm install
npm run build
```

## Quick Start

1. Open your project folder.
2. Run the setup wizard:

```bash
taki init
```

3. Start dashboard:

```bash
taki run
```

You can also run simply:

```bash
taki
```

## Common Commands

```bash
taki init
taki run
taki --config ./taki.json
taki run --config ./taki.json
```

## Interactive Init

`init` generates a `taki.json` file through guided prompts.

It supports:

- back navigation with Left Arrow or Esc
- live config preview
- compact preview mode for small terminals
- optional `package.json` script setup (`scripts.taki`)

Flags:

- `--config <path>`: choose output path
- `--force`: overwrite without prompt

## Dashboard Controls

### Core

- `q` or `Ctrl+C`: quit and shutdown all services
- `r`: restart focused service
- `o`: open options

### Single-pane mode

- `Up/Down` or `j/k`: select service log stream

### Split and grid modes

- Arrow keys or `h/j/k/l`: move pane focus
- `Tab`: jump to next pane

### Full-log view

- Open via `o` -> Full log
- `Esc`: return to dashboard

## Layout Options

Use `o` to open options and configure layout:

- single pane
- vertical panes (configurable count)
- horizontal panes (configurable count)
- grid panes (configurable columns and rows)

## Config File (`taki.json`)

Example:

```json
{
  "services": [
    {
      "name": "web",
      "command": "npm",
      "args": ["run", "dev"],
      "color": "green",
      "healthCheck": {
        "type": "log",
        "pattern": "ready"
      }
    },
    {
      "name": "api",
      "command": "uvicorn",
      "args": ["main:app", "--reload", "--port", "8000"],
      "color": "yellow",
      "startAfter": ["web"],
      "healthCheck": {
        "type": "http",
        "url": "http://127.0.0.1:8000/health",
        "intervalMs": 500,
        "timeoutMs": 20000
      }
    }
  ],
  "maxLogLines": 200
}
```

## Service Fields

- `name`: label shown in dashboard
- `command`: executable to run
- `args`: optional argument array
- `color`: label color
- `cwd`: optional working directory
- `env`: optional extra environment variables
- `startAfter`: optional dependency list
- `healthCheck`: optional readiness gate

## Health Checks

### Log health check

```json
{
  "type": "log",
  "pattern": "ready",
  "timeoutMs": 20000
}
```

### HTTP health check

```json
{
  "type": "http",
  "url": "http://127.0.0.1:3000/health",
  "intervalMs": 500,
  "timeoutMs": 20000
}
```

## Publish

```bash
npm version patch
npm test
npm run pack:check
npm publish --access public
```

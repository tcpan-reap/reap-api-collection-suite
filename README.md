# Reap API Collection Suite

A standardized local framework for developing, simulating, and validating integrations with the **Reap API**.

This repository enables repeatable testing of payment workflows, transaction lifecycles, and webhook-driven event handling in a structured and extensible manner.

---

## Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Starting the Local Environment](#starting-the-local-environment)
- [Webhook Configuration](#webhook-configuration)
- [Running a Workflow](#running-a-workflow)
- [Webhook Event Handling](#webhook-event-handling)
- [Adding a New Workflow](#adding-a-new-workflow)
- [Stopping the Environment](#stopping-the-environment)
- [Future Direction](#future-direction)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The **Reap API Collection Suite** provides a modular development environment that allows teams to:

- Simulate real-world payment workflows
- Validate transaction state transitions
- Receive and inspect webhook events locally
- Develop new API use cases in isolation
- Maintain structured, repeatable integration testing

Each workflow is self-contained and mirrors practical API interaction patterns used in production environments.

---

## Architecture Principles

This framework is designed with the following principles:

- **Modularity** – Each workflow is independent and self-contained  
- **Extensibility** – New workflows can be added without modifying core infrastructure  
- **Repeatability** – Consistent simulation of API and webhook behavior  
- **Separation of concerns** – Webhook infrastructure and workflows are decoupled  
- **Environment-driven configuration** – No hardcoded credentials or endpoints  

---

## Repository Structure

```bash
.
├── tools/
│   ├── 1_simulate_transaction/
│   └── webhook_server/
├── generate_postman_schema/
├── .env
├── package.json
└── README.md
```

| Path | Description |
|------|-------------|
| `tools/<n>_<workflow>` | Self-contained API workflows |
| `tools/webhook_server` | Local Express webhook listener |
| `generate_postman_schema` | Utilities for Postman schema generation |
| `.env` | Environment configuration |
| `package.json` | Project dependencies and scripts |

### Workflow Design

- Each numbered folder under `tools/` represents a complete API workflow.
- Numbering reflects logical grouping, not execution dependency.
- Workflows must be executed manually.
- Workflows share common webhook infrastructure.

---

## Prerequisites

### System Requirements

- Node.js **v18+**
- npm

### Access Requirements

- Valid Reap API credentials

---

## Environment Setup

Create a `.env` file in the project root:

```env
API_BASE_URL=<API-BASE-URL>
API_KEY=<API-KEY>
ACCEPT_VERSION=<ACCEPT-VERSION>
WEBHOOK_SUBSCRIBE_URL=<PUBLIC-WEBHOOK-URL>
```

| Variable | Description |
|----------|------------|
| `API_BASE_URL` | Base endpoint for Reap APIs |
| `API_KEY` | API authentication key |
| `ACCEPT_VERSION` | API version header |
| `WEBHOOK_SUBSCRIBE_URL` | Public webhook receiver URL |

> ⚠️ A public HTTPS endpoint is required for webhook-driven workflows.

---

## Installation

Install dependencies:

```bash
npm install
```

---

## Starting the Local Environment

Start all required runtime services:

```bash
npm run start:all
```

This command automatically starts:

- Local webhook server (Express)
- An ngrok tunnel that exposes the webhook server to the public internet

The generated public HTTPS URL is required for webhook subscriptions and can be used as:

```
WEBHOOK_SUBSCRIBE_URL
```

This is the default entry point for all workflows in this repository.

---

## Webhook Configuration

After starting the local environment:

1. Copy the generated public HTTPS URL from the ngrok output.
2. Update `WEBHOOK_SUBSCRIBE_URL` in `.env`.
3. Register the webhook endpoint:

```bash
npm run subscribe:webhook
```

Webhook subscription is required before running any webhook-driven workflows.

---

## Running a Workflow

Each workflow must be executed manually.

Example:

```bash
node tools/1_simulate_transaction/index.js
```

Workflows may include:

- Resource creation
- Transaction simulations
- State transitions
- Webhook-triggering actions
- Response validation

Workflows do not auto-chain. Each is run independently.

---

## Webhook Event Handling

The local webhook server:

- Receives events from Reap
- Logs headers and payloads
- Responds with HTTP 200
- Enables inspection via ngrok dashboard

ngrok dashboard:

```bash
http://localhost:4040/inspect/http
```

This enables validation of real-time event behavior during workflow execution.

---

## Adding a New Workflow

To add a new workflow:

1. Create a new folder under `tools/`
2. Implement an `index.js`
3. Follow the existing workflow structure

Each workflow should:

- Load environment variables
- Validate configuration
- Execute API calls
- Handle errors explicitly
- Include a top-of-file documentation comment describing its purpose

No changes to infrastructure are required.

---

## Stopping the Environment

In the terminal running the services:

```bash
Ctrl + C
```

This cleanly shuts down:

- Webhook server
- ngrok tunnel

---

## Future Direction

This framework is designed to evolve alongside the Reap API.

### Portability Target: Postman + Coast Compatibility

Future enhancements aim to support:

- Importable Postman collections
- Environment parameterization
- Workflow reusability across environments
- Visual workflow rendering (Coast)

The long-term objective is a tool-agnostic workflow definition that supports:

- API execution
- Simulation
- Validation
- Visualization

---

## Contributing

When contributing:

- Maintain modular workflow structure
- Avoid modifying shared infrastructure unless necessary
- Document new workflows clearly
- Ensure environment-driven configuration
- Keep workflows deterministic and reproducible


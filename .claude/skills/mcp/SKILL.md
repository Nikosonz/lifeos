---
name: mcp
description: Use when building the MCP client surface for LifeOS (P2, "MCP clients" in the original client list) — not built yet. The core question is always "does this add a new capability or just a new transport for an existing one."
---

# Building MCP support for LifeOS

Not started yet (P2, alongside AI agents and the public API per the
roadmap). MCP is one of the seven planned clients (CLAUDE.md intro) —
everything in `backend-architecture` and Rule 4 ("can Android use this?
substitute "can an MCP client use this?") applies without modification.

## The one question that matters

**An MCP server for LifeOS is a new transport, not a new capability
surface.** Every MCP tool it exposes should be a thin wrapper that calls
an existing `/api/v1` route (or the same `packages/core` service that
route calls) — never a new implementation of "list my tasks" or "log an
expense" that duplicates logic already living in `packages/core`. If an
MCP tool needs a capability that doesn't exist as an `/api/v1` route yet,
build the route first (in whatever module owns it), then wrap it — don't
build the capability inside the MCP server.

## Likely shape

A small adapter layer (could live in `apps/mcp` as a new workspace, or
as a thin process wrapping the existing `/api/v1` surface via HTTP,
depending on how MCP transport is implemented) whose tools are things
like `list_tasks`, `create_transaction`, `get_dashboard_summary` — each
one calls the corresponding `/api/v1` endpoint with the user's Bearer
token, maps the response, and returns it. No business logic, no direct
`@lifeos/core` or `@lifeos/db` imports if it's a separate process talking
over HTTP; if it's in-process, the same boundary rules apply (`core`
only, never `db`).

## Auth

MCP clients authenticate the same way every other client does — Bearer
access token, refresh-token rotation, the existing `/api/v1/auth/*`
routes (ADR-0004). Don't invent an MCP-specific auth mechanism; the
whole point of the API-first design is that MCP doesn't need one.

## Don't build this speculatively

This skill exists so that when MCP work starts, it starts from the right
principle. There's no code to write yet — don't scaffold an `apps/mcp`
workspace or install an MCP SDK until this is actually being built.

# Event System

## Event Bus Architecture
Recovery+ uses a robust, offline-first Event Bus (`src/lib/events/event-bus.ts`) for decoupled cross-module communication. 

Key features include:
- **IndexedDB Persistence**: Events are persisted to `db.eventStore` before dispatch to guarantee durability.
- **Reliability & Replay**: On startup, any unacknowledged events in the store are replayed to ensure no state drops during abrupt browser closures.
- **Idempotency**: Uses `eventReliabilityManager` to generate unique keys based on the topic, payload, and timestamp to prevent duplicate event processing.
- **Performance Queue**: Batches event execution asynchronously to avoid blocking the main UI thread during rapid interactions.

## Event Types & Priorities
Events are defined in `src/lib/events/event-catalog.ts`. Priorities dictate the processing order within the performance queue.

- **P0 (Critical)**: `recovery.urge.logged`, `notification.triggered`, `planning.plan.failed`
- **P1 (High)**: `log.sleep.created`, `score.recovery.updated`, `system.day.changed`, `log.prayer.updated`, `ai.schedule.optimized`, etc.
- **P2 (Normal)**: `log.meal.created`, `log.water.created`, `log.mood.updated`, `ai.prediction.updated`, etc.
- **P3 (Low)**: `system.backup.completed`

## Payloads
Payloads (`T`) depend on the specific event, and are always wrapped in an `EventEnvelope` containing:
- `traceId`: A unique string for tracing event origin and debugging.
- `causalDepth`: Tracks the depth of nested reaction chains.
- `idempotencyKey`: Unique hash of the payload, topic, and timestamp.
- `acknowledged`: Boolean flag for completion status in the database.

## Subscribers
Subscribers register via `eventBus.subscribe(subscriberId, topicPattern, callback, priority)`. 
Topic patterns support wildcards (e.g., `log.*.created` matches any creation log, or `score.#` matches anything under score). 
Callbacks receive the `EventEnvelope` and process state updates accordingly.

## Reaction Chains & Anti-Circular-Dependency Rules
To prevent infinite loops when events trigger other events:
- **Causal Depth**: Tracked in the envelope, incrementing on each nested trigger.
- **Reaction System**: `crossModuleReactionSystem.validateReaction(parentEnvelope, topic)` enforces a Directed Acyclic Graph (DAG) for reactions.
- If an event exceeds the maximum causal depth or violates the DAG topology, it is explicitly rejected and logged.

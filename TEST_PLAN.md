# Test Plan

## Existing Tests
The application currently has several ad-hoc test scripts located in `src/lib/`:
- `test-regression-suite.js`: General regression tests.
- `regression-investigation.test.ts`: Specifically testing mathematical boundary issues and score clamping.
- `day-boundary-transition.test.ts`: Tests the `DayBoundaryManager` for accurate midnight rollovers and day transitions.
- `events/test-event-bus.ts`: Validates event publishing, idempotency, and wildcard subscription logic.
- `deen/test-deen-scoring.js`, `deen/test-prayer-engine.js`, `deen/test-prayer-timeline.js`, `deen/test-prayer-logging.js`, `deen/test-prayer-migration.js`, `deen/test-deen-analytics.js`, `deen/test-backup-restore.js`: Comprehensive test suite for solar calculations, logging, timelines, and scoring logic.

## Important Test Scenarios
- **Database Tests**: Exporting/Importing Dexie JSON backups (v1 through v5). Verifying lossless migrations of legacy prayer booleans.
- **Scoring Tests**: 
  - Dynamic weight redistribution when a category is fully `not_tracked`.
  - Zero-floor avoidance (ensuring score doesn't drop below 10 unless all data is 0).
- **Event Tests**: Circular dependency blocking via `crossModuleReactionSystem`.
- **UI/Functional Verification**: Checking the `DashboardView` SVG ring responsiveness when a routine checkbox is clicked.

## Known Gaps
- **Status:** PARTIALLY IMPLEMENTED
- The codebase lacks a unified testing framework (e.g., Jest, Vitest, Playwright). Current tests are standalone Node/Deno scripts rather than an automated CI/CD suite.
- Lack of E2E UI tests for the PWA offline functionality.

# Security

## Authentication
- **Status:** NOT IMPLEMENTED
- The application is a single-user, local-only client. There is no login, registration, or JWT authentication system.

## Data Protection
- **Status:** IMPLEMENTED (Local Isolation)
- All user telemetry, logs, and journals are stored entirely on the device using IndexedDB (Dexie).
- No data is transmitted to a remote backend server, ensuring absolute privacy from network interception.

## API Keys & Secrets
- **Status:** NOT IMPLEMENTED (By design)
- The application relies on zero external APIs. Solar calculations run via local math algorithms. Thus, no API keys are embedded or exposed.

## IndexedDB Security Considerations
- **Warning:** Data in IndexedDB is unencrypted at rest. Any script running on `localhost:3000` or the deployed domain with cross-site scripting (XSS) vulnerabilities could theoretically access the database.
- Physical access to the user's unlocked device grants access to the data via browser DevTools.

## Known Limitations
- No end-to-end encryption for the JSON backup export files. Exports are plaintext JSON.

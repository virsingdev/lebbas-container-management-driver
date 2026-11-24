# LEBBAS Container Management — Driver PWA

**A mobile-first Progressive Web Application for LEBBAS field drivers to manage daily container collection operations across the UAE.**

<p align="center">

**Driver Application:** `https://driver.container.lebbas.com`

**Admin Dashboard:** `https://container.lebbas.com`

**Backend API:** `https://container-api.lebbas.com`

**API Documentation:** `https://container-api.lebbas.com/docs`

</p>

---

## 1. Project Overview

The LEBBAS Container Management Driver PWA is the mobile application used by field drivers to perform assigned clothing-container collection operations.

Drivers can use their smartphones to:

- Log in securely.
- View their driver profile and operational dashboard.
- Start and end their shifts.
- View assigned daily routes.
- Navigate between assigned container locations.
- View container details and QR codes.
- Record completed and unsuccessful stops.
- Record collection weights where supported.
- Report operational incidents.
- Work offline and synchronize pending operations when connectivity returns.
- Review collection and synchronization history.

The application is designed for Android and iPhone browsers and can be installed on the phone's home screen.

**Important:** This is a separate frontend application from the Admin Dashboard. Both applications share the same FastAPI backend, database and authentication infrastructure.

## 2. Application Architecture

```text
                    LEBBAS PLATFORM
                           |
             +-------------+-------------+
             |                           |
       ADMIN DASHBOARD              DRIVER PWA
       Next.js Web App              Next.js PWA
             |                           |
  container.lebbas.com        driver.container.lebbas.com
             |                           |
             +-------------+-------------+
                           |
                    FASTAPI BACKEND
                           |
                container-api.lebbas.com
                           |
                      PostgreSQL
```

### Applications

| Application | Domain | Purpose |
|---|---|---|
| Admin Dashboard | container.lebbas.com | Management and operations |
| Driver PWA | driver.container.lebbas.com | Mobile field operations |
| FastAPI Backend | container-api.lebbas.com | Shared API and business logic |

### Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 14 | Application framework |
| React 18 | UI components |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| TanStack Query | API state and caching |
| Dexie.js | IndexedDB offline storage |
| Leaflet | Interactive maps |
| jsQR / QR scanner | Container QR identification |
| Browser Geolocation API | Driver location |
| PWA / Service Worker | Installable application and offline assets |

Use the actual installed dependency versions recorded in `package-lock.json`.

## 3. Repository Information

**GitHub Repository**

`virsingdev/lebbas-container-management-driver`

**Local Development Directory**

`D:\Projects\lebbas-container-management-driver`

**Production Directory**

`/var/www/lebbas-container-management-driver`

**Production Domain**

`https://driver.container.lebbas.com`

## 4. Local Development Setup

### Prerequisites

Install:

- Node.js 20 or compatible supported version
- npm
- Git
- Visual Studio Code or another code editor

### Clone Repository

```powershell
cd D:\Projects

git clone https://github.com/virsingdev/lebbas-container-management-driver.git

cd lebbas-container-management-driver
```

If the project already exists locally, open its existing directory instead of cloning again.

### Install Dependencies

```powershell
npm install
```

### Configure Environment Variables

Create `.env.example` with the required variable names and safe placeholder values.

Copy it locally:

```powershell
Copy-Item .env.example .env.local
```

Example:

```env
# Server-side only. Never expose this using NEXT_PUBLIC_.
API_BASE_URL=https://container-api.lebbas.com/api/v1

# Application configuration
NEXT_PUBLIC_APP_NAME="LEBBAS Driver"
NEXT_PUBLIC_APP_URL=http://localhost:3011
```

Use the actual environment variable names expected by the application.

Never commit `.env.local` or production secrets to GitHub.

### Run Development Server

```powershell
npm run dev
```

Local application:

`http://localhost:3011`

The Admin Dashboard can continue running independently on port 3000.

### Quality Checks

```powershell
npm run typecheck
npm run lint
npm run build
```

If a script is not yet defined in `package.json`, add it appropriately or document the missing script. Do not report a check as passed unless it has actually run successfully.

## 5. Mobile Device Testing

Camera access, GPS and service workers require a secure context.

For testing on a physical phone, use HTTPS.

Recommended options:

1. Deploy to a staging HTTPS subdomain.
2. Use a secure tunnel such as ngrok.

Example:

```bash
npx ngrok http 3011
```

Open the generated HTTPS address on the mobile device.

Test the following:

- Android Chrome
- iPhone Safari
- Camera permission
- QR scanning
- GPS permission
- Map rendering
- Offline operation
- Reconnection and synchronization
- PWA installation

Do not assume that localhost on the development computer is accessible as localhost on a phone.

## 6. Backend API Integration

**Backend Base URL**

`https://container-api.lebbas.com/api/v1`

**Swagger Documentation**

`https://container-api.lebbas.com/docs`

**OpenAPI Specification**

`https://container-api.lebbas.com/openapi.json`

The Driver PWA must integrate with the existing FastAPI backend.

Do not create duplicate business logic or a separate driver database.

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Driver login |
| POST | `/auth/refresh` | Refresh session |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Authenticated user profile |

Authentication is handled through a server-side proxy.

The intended authentication cookies are:

- `lcd_at` — access token
- `lcd_rt` — refresh token

Cookies should use appropriate `HttpOnly`, `Secure` and `SameSite` settings. The frontend must never expose these tokens to browser JavaScript.

Review cookie domain and cross-subdomain behavior during production deployment.

### Driver Portal

| Method | Endpoint | Description |
|---|---|---|
| GET | `/driver/me` | Driver profile |
| GET | `/driver/dashboard` | Driver dashboard |

### Driver Shifts

| Method | Endpoint | Description |
|---|---|---|
| POST | `/driver/shifts/start` | Start shift |
| POST | `/driver/shifts/end` | End shift |
| GET | `/driver/shifts/current` | Current shift |
| GET | `/driver/shifts` | Shift history |

### Driver Routes

| Method | Endpoint | Description |
|---|---|---|
| GET | `/driver/routes` | Assigned routes |
| GET | `/driver/routes/{route_id}` | Route details |
| POST | `/driver/routes/{route_id}/start` | Start assigned route |
| POST | `/driver/routes/{route_id}/complete` | Complete route |
| PATCH | `/driver/routes/{route_id}/stops/{stop_id}/status` | Update stop status |

### Containers

| Method | Endpoint | Description |
|---|---|---|
| GET | `/containers/qr/{qr_code}` | Retrieve container using QR code |

### Collections

| Method | Endpoint | Description |
|---|---|---|
| POST | `/collections` | Create collection |
| GET | `/collections` | List collections |
| GET | `/collections/{collection_id}` | Collection details |
| POST | `/collections/{collection_id}/photos` | Add collection photo |

Collection access and request requirements must be verified against the actual backend authorization rules and OpenAPI schemas.

### Driver Incidents

| Method | Endpoint | Description |
|---|---|---|
| POST | `/driver/incidents` | Create incident |
| GET | `/driver/incidents` | List driver incidents |
| GET | `/driver/incidents/{incident_id}` | Incident details |
| POST | `/driver/incidents/{incident_id}/photos` | Add incident photo |
| GET | `/driver/incidents/{incident_id}/photos` | List incident photos |

### Offline Synchronization

| Method | Endpoint | Description |
|---|---|---|
| POST | `/driver/sync` | Submit synchronization batch |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Backend health check |

**API integration rule:** Always verify request schemas, response schemas, validation rules, status values and permissions from the live OpenAPI specification before implementing or changing an integration.

## 7. Driver Application Modules

The application should contain the following primary screens.

### A. Login

- Driver authentication
- Session handling
- Validation
- Secure logout

### B. Home Dashboard

- Driver profile
- Assigned emirate
- Assigned vehicle, when available
- Current shift
- Today's assigned route
- Route progress
- Completed stops
- Pending stops
- Next container
- Pending synchronization count

Display only actual API-backed or correctly derived data.

### C. My Routes

- Assigned routes
- Route details
- Ordered stops
- Container details
- Stop status
- Route progress
- Start and complete route actions

### D. Route Map

- Current GPS location
- Container markers
- Assigned route stops
- Completed and pending stops
- Map zoom and navigation
- Open directions in an external navigation application

### E. Container Details

- Container identification
- QR code lookup
- Container location
- Container status
- Assigned stop details

### F. Collection Recording

- Select assigned container
- Record collection weight
- Record bag count if supported
- Add notes
- Capture photographs when upload support is available
- Submit and review collection

### G. Incident Reporting

- Incident type
- Description
- Location when supported
- Photograph when upload support is available
- Incident history

### H. History and Synchronization

- Completed operations
- Pending operations
- Failed operations
- Conflicted operations
- Retry synchronization
- Last successful synchronization

### I. Profile

- Driver information
- Employee code
- Assigned emirates
- Current shift
- Logout

## 8. Offline-First Architecture

Offline support is essential for field operations where mobile internet may be unreliable.

Use IndexedDB through Dexie.js for persistent local storage.

### Offline-capable data

Where permitted by the backend contract:

- Driver profile
- Assigned routes
- Route stops
- Container details
- Pending stop updates
- Pending incident submissions
- Synchronization history

### Synchronization Workflow

```text
Driver performs an operation
             |
             v
      Validate operation
             |
             v
      Save to IndexedDB
             |
             v
     Check backend reachability
             |
        +----+----+
        |         |
      Online    Offline
        |         |
        v         v
   Submit sync   Keep pending
      batch      in IndexedDB
        |         |
        v         |
   Read server    |
   acknowledgment|
        |         |
        +----+----+
             |
             v
       Update status
             |
             v
      Show sync result
```

### Operation States

- `pending`
- `syncing`
- `synced`
- `failed`
- `conflict`

Only mark an operation as synced when the backend confirms successful processing.

### Synchronization Rules

- Generate unique client operation identifiers where supported.
- Persist operations before attempting network requests.
- Prevent duplicate submissions.
- Preserve failed operations.
- Retry safely.
- Synchronize when connectivity returns.
- Check backend reachability rather than relying exclusively on `navigator.onLine`.
- Never silently delete pending records.
- Never overwrite newer server data with stale cached information.
- Keep driver-specific records isolated.
- Clear sensitive cached profile and route data on logout according to the session policy.
- Never discard unsynchronized records without an explicit, safe policy.

### Important Backend Limitation

The actual synchronization contract must be inspected before implementing payloads.

The following must be verified:

1. Supported operation types.
2. Payload format.
3. Idempotency mechanism.
4. Duplicate protection.
5. Conflict response.
6. Batch acknowledgment format.
7. Partial success behavior.
8. Retry behavior.

Do not assume that every API operation supports offline synchronization.

## 9. GPS and Route Tracking

Use the browser Geolocation API with explicit driver permission.

Display:

- GPS permission state
- Latitude and longitude
- Location accuracy
- Last location update

The current backend specification does not clearly establish a dedicated continuous driver GPS tracking endpoint.

GPS data may currently be included in stop updates, subject to the actual request schema.

### Proposed future backend capabilities

If continuous driver tracking is required, consider:

`POST /api/v1/driver/location`

Suggested data:

- latitude
- longitude
- accuracy_meters
- recorded_at
- shift_id
- route_id

For the Admin Dashboard:

`GET /api/v1/driver-locations/latest`

These are proposed endpoints, not confirmed existing APIs.

**PWA limitation:** Browser-based GPS tracking is not guaranteed to continue when the application is closed or suspended. Reliable continuous background tracking may require a native mobile application.

## 10. Photo Upload Limitation

The existing collection and incident photo APIs appear to use a `file_key`.

A complete file-upload or signed-URL workflow must be verified.

Until the backend supports actual file upload:

- Do not show fake successful uploads.
- Do not claim photographs are stored.
- Keep photo upload unavailable or clearly marked as pending backend support.

## 11. Current Backend Integration Considerations

The following assumptions must be verified through real API tests.

| Area | Verification required |
|---|---|
| Collection creation | Whether completed stop updates create collection records |
| Stop synchronization | Whether sync payload matches stop-status schema |
| Incident synchronization | Whether incident creation is supported by sync |
| Collection history | Whether driver accounts can access collection endpoints |
| QR lookup | Whether driver authorization is supported |
| GPS | Whether location is saved outside stop updates |
| Photos | Whether actual file uploads are available |
| Authentication | Whether the driver login contract supports the intended cookie proxy |
| Offline workflow | Whether the backend guarantees idempotency and conflict handling |

Document verified behavior and unresolved assumptions separately.

## 12. PWA Requirements

Application name: LEBBAS Driver

Short name: LEBBAS

Start URL: `/`

Display mode: `standalone`

Configure:

- Web app manifest
- App icons
- Theme color
- Service worker
- Offline fallback
- Application shell caching
- Safe cache versioning
- Install instructions
- Update notification

Do not cache authentication secrets or sensitive API responses in an unsafe manner.

## 13. Suggested Project Structure

```text
src/
├── app/
│   ├── login/
│   ├── dashboard/
│   ├── routes/
│   ├── map/
│   ├── containers/
│   ├── collections/
│   ├── incidents/
│   ├── history/
│   └── profile/
│
├── components/
│   ├── layout/
│   ├── navigation/
│   ├── shared/
│   └── ui/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── shifts/
│   ├── routes/
│   ├── containers/
│   ├── qr-scanner/
│   ├── collections/
│   ├── incidents/
│   ├── gps/
│   └── offline-sync/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── storage/
│   ├── offline/
│   ├── maps/
│   └── utils/
│
├── hooks/
└── types/
```

Adapt the structure to the actual implementation. Avoid unnecessary abstraction.

## 14. Testing and Quality Assurance

Test the following:

- Authentication
- Session refresh
- Driver authorization
- Route loading
- Shift start and end
- Route start and completion
- Stop status updates
- Collection recording
- QR scanning
- Incident reporting
- Offline data persistence
- Synchronization retries
- Duplicate protection
- GPS permissions
- Mobile responsive layouts
- PWA installation

Required checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

Test on actual Android and iPhone devices before production release.

Do not claim mobile compatibility based only on desktop browser testing.

## 15. Security Requirements

- Use HTTPS in production.
- Protect driver sessions.
- Use secure HTTP-only cookies where supported.
- Do not expose secrets in frontend code.
- Validate all form input.
- Validate file types and sizes.
- Enforce route and stop ownership on the backend.
- Do not trust client-supplied driver IDs.
- Never rely on frontend permission checks alone.
- Avoid logging tokens or personal information.
- Do not store sensitive data unnecessarily.

## 16. Deployment

### Production Domain

`https://driver.container.lebbas.com`

### Production Directory

`/var/www/lebbas-container-management-driver`

### Production Port

`3011`

### Deployment Workflow

1. Develop on Windows.
2. Test locally.
3. Run lint, typecheck and production build.
4. Commit changes to Git.
5. Push to GitHub.
6. Deploy the reviewed version to VPS.
7. Install dependencies using `npm ci`.
8. Configure production environment variables.
9. Build the application.
10. Run Next.js using PM2 or systemd.
11. Configure Nginx reverse proxy.
12. Configure HTTPS.
13. Verify application and API integration.
14. Test installation and offline workflows on a real mobile device.

Do not develop directly on the production VPS.

Do not modify existing Laravel, n8n, or FastAPI production services without approval.

## 17. Development Roadmap

| Phase | Deliverable |
|---|---|
| 1 | Project setup, PWA foundation and authentication |
| 2 | Driver profile and dashboard |
| 3 | Shifts and assigned routes |
| 4 | Route map and GPS |
| 5 | Container details and QR scanning |
| 6 | Collection recording |
| 7 | Incident reporting |
| 8 | IndexedDB and offline synchronization |
| 9 | Testing, security and optimization |
| 10 | Production deployment |

Each phase must be tested before starting the next major phase.

## 18. Definition of Done

The application is ready for production only when:

- Driver authentication works.
- Driver-specific authorization is enforced.
- Assigned routes load correctly.
- Drivers can complete supported collection workflows.
- Offline records persist across restarts.
- Synchronization handles failures safely.
- Duplicate operations are prevented.
- Maps show real location data where available.
- No fake API responses are used in production.
- Mobile UI works on real devices.
- Production HTTPS and PWA installation work.
- All critical workflows have been tested.

## 19. Project Objective

Deliver a secure, reliable, installable mobile application that supports real-world LEBBAS clothing-container collection operations across the UAE.

The Driver PWA must integrate with the existing FastAPI backend and operate independently from the Admin Dashboard while sharing the same backend infrastructure.

**Development principle: Build the real operational workflow first, verify every API integration, and never simulate a feature that the backend does not support.**
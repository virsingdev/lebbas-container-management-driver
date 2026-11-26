# Zero-Scan Pickup Detection: FastAPI + Driver PWA Specification

This document specifies how to implement **GPS Geofencing + Dwell Time Detection** across the LEBBAS Driver PWA (`driver.container.lebbas.com`) and the shared FastAPI + PostGIS backend (`container-api.lebbas.com`), and compares it with OBD vehicle telemetry and BLE beacons.

---

## 1. Architecture Overview

```text
Driver Phone (PWA foreground)                 FastAPI + PostGIS Backend
─────────────────────────────                 ─────────────────────────
watchPosition (high accuracy)
  │
  ├─► Filter noisy fixes (accuracy > 50m)
  ├─► Haversine check vs. open route stops
  │
  ├─► Enter ≤ 65m (dwell timer starts)
  │     └─ Stay ≤ 95m for ≥ 45s
  │          ├─► Auto-enqueue `arrived` ────► POST /api/v1/driver/sync
  │          └─► Show 1-tap "Confirm Pickup"    (route_stop_status_update)
  │                └─► Enqueue `completed` ─► POST /api/v1/driver/sync
  │
  └─► (Future) Batched telemetry pings ─────► POST /api/v1/driver/location
                                                └─ ST_DWithin geofence & audit
```

### Design Principles

1. **Works immediately with existing sync API:** Today's backend (`POST /api/v1/driver/sync`) already accepts `route_stop_status_update` operations with `status` (`en_route | arrived | completed | skipped | failed`), `latitude`, `longitude`, `gps_accuracy_meters`, `collected_weight_kg`, `bag_count`, `collected_at`, and `sync_idempotency_key`.
2. **Offline-first:** Auto-arrival and 1-tap pickup confirmations write to IndexedDB (`db.ops`) first and sync when `/health` is reachable.
3. **Browser PWA constraint:** iOS Safari and Android Chrome suspend `navigator.geolocation.watchPosition` when the app is backgrounded or the screen locks. Foreground geofencing therefore assumes the phone is open on a cab mount during active route execution (optionally paired with the Screen Wake Lock API).

---

## 2. Client-Side Geofence & Dwell Rules (PWA)

| Parameter | Value | Rationale |
|---|---|---|
| Maximum accepted GPS error | `50 m` | Rejects coarse cell-tower/Wi-Fi fixes that trigger false arrivals |
| Entry radius | `65 m` | Balances urban UAE GPS drift (`10–35 m`) against container spacing |
| Exit hysteresis radius | `95 m` | Prevents boundary jitter from resetting the dwell timer |
| Dwell threshold | `45 s` | Filters drive-bys and brief traffic stops near a container |
| Candidate stops | Open stops (`pending`, `en_route`, `arrived`) on active route with valid `latitude`/`longitude` | Picks the **closest** qualifying container if multiple are within `65 m` |
| Auto-`arrived` action | Enqueues `route_stop_status_update` (`status: "arrived"`) once per stop when transitioning from `pending` or `en_route` | Keeps dispatch informed without extra taps |
| Pickup confirmation | Opens 1-tap **Confirm Pickup** prompt (weight + optional bags/notes) and marks the stop geofence-verified | Eliminates mandatory camera QR scan while keeping QR scan available |
| Manual override / dismiss | Driver can dismiss the prompt for a stop (`dismissed` for current approach until they leave `95 m`) | Handles traffic delays or adjacent bins |

---

## 3. Proposed FastAPI + PostGIS Backend Contract

The following endpoints and schema additions are **proposed** (not yet present in `/openapi.json`) to support server-side telemetry, auditability, and admin fleet visibility.

### 3.1 `POST /api/v1/driver/location` (Batched Telemetry)

Accepts 1–50 buffered GPS samples from the PWA (or native wrapper) so intermittent connectivity does not lose breadcrumbs.

**Request:**

```json
{
  "shift_id": "uuid | null",
  "route_id": "uuid | null",
  "points": [
    {
      "client_point_id": "uuid",
      "latitude": 25.204849,
      "longitude": 55.270783,
      "accuracy_meters": 12.4,
      "speed_mps": 0.4,
      "heading": 182.0,
      "recorded_at": "2026-11-25T12:20:00Z"
    }
  ]
}
```

**Server processing (FastAPI + PostGIS):**
- Derive `driver_id` strictly from the authenticated JWT (`current_driver`), never from the request body.
- Deduplicate on `(driver_id, client_point_id)`.
- Persist points to `driver_location_logs` (`GEOGRAPHY(POINT, 4326)` with GIST index).
- Run `ST_DWithin` against assigned route stops (`radius_meters = 65`) and compute dwell window from consecutive low-speed (`< 2.0 m/s`) points inside the geofence.

**Response (`200 OK`):**

```json
{
  "accepted": 1,
  "nearby_stops": [
    {
      "stop_id": "uuid",
      "container_id": "uuid",
      "distance_meters": 18.6,
      "dwell_seconds": 48,
      "geofence_state": "dwelled"
    }
  ]
}
```

### 3.2 `GET /api/v1/driver-locations/latest` (Admin Dashboard)

Returns the latest known location per active driver/shift for the Admin live operations map (role-gated to dispatchers/admins).

### 3.3 Verification Audit Field on Stop Updates

Extend `DriverRouteStopStatusUpdateRequest` (and `collections`) with optional verification metadata:

```json
{
  "verification_method": "qr | geofence | manual",
  "geofence_distance_meters": 18.6,
  "geofence_dwell_seconds": 48
}
```

Backend validation can enforce that `verification_method = "geofence"` is accepted only when `(latitude, longitude)` is within `<= 100 m` of `container.(latitude, longitude)` with `gps_accuracy_meters <= 65`.

---

## 4. Option Comparison: When to Add OBD Telemetry or BLE Beacons

| Capability | 1. PWA Foreground Geofence (Implemented now) | 2. Nissan Urvan OBD / Hardwired GPS | 3. BLE Beacons + Native Wrapper |
|---|---|---|---|
| **Works with screen locked / app closed** | No (browser OS restriction) | **Yes** (vehicle ignition / cellular) | Yes (requires Capacitor / React Native) |
| **Hardware cost** | \$0 | Fleet tracker + SIM subscription | ~\$8–\$15/container + native app |
| **Typical accuracy** | `10–50 m` outdoors | `5–20 m` | `2–15 m` (even covered/indoor bays) |
| **Best role in LEBBAS** | Immediate zero-scan arrival & 1-tap driver workflow | Reliable passive arrival/route proof even if phone dies | Only if containers sit inside malls/basements or < 15 m apart |

### Recommended Phased Rollout

1. **Phase A (Now — PWA):** Foreground GPS geofencing + dwell detection using existing `POST /api/v1/driver/sync`.
2. **Phase B (FastAPI):** Add `POST /api/v1/driver/location`, `GET /api/v1/driver-locations/latest`, and `verification_method` audit fields.
3. **Phase C (Fleet Telematics):** Ingest Nissan Urvan GPS vendor webhooks/polling into a backend matcher (`ST_DWithin` against route stops) to cross-verify arrivals even when a driver's browser was closed.

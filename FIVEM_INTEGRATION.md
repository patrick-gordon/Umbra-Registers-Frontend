# FiveM NUI Integration

## Browser -> FiveM callbacks (POST)
The UI calls these NUI callbacks on your resource:

- `close`
- `ringUp`
- `enableCustomerActions`
- `customerPaid`
- `customerStole`
- `stealMinigameStarted`
- `stealMinigameResolved`
- `registerTierUpgraded`
- `ringUpMachineError`
- `stealAttemptAutoBlocked`

### Checkout flow (intent tray -> commit on ring-up)
Current implemented flow:

1. Employee builds an intent tray in UI (items and combos).
2. UI sends `ringUp` with intent tray/total.
   - UI stays interactive while processing occurs.
3. Server validates inventory quantities, combo eligibility, discounts, and tier rules.
4. On success, server consumes inventory and returns authoritative tray pricing/totals.
5. On failure, server returns structured validation errors and UI stays in employee edit mode.
6. Employee can adjust tray and retry `ringUp`.
7. After successful ring-up, employee triggers `enableCustomerActions`.

### Correlation IDs (required for checkout/steal/tier callbacks)
Use these IDs on every checkout/steal/tier callback for dedupe, tracing, and replay protection:

- `uiSessionId`: unique for each register UI open/close lifecycle.
- `transactionId`: unique for each checkout attempt lifecycle (ring-up through final resolution).

Apply both IDs to:
- `ringUp`
- `enableCustomerActions`
- `customerPaid`
- `customerStole`
- `stealMinigameStarted`
- `stealMinigameResolved`
- `ringUpMachineError`
- `stealAttemptAutoBlocked`
- `registerTierUpgraded`

Payload examples:

- `ringUp` (intent payload; server must validate/recompute)
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "transactionId": "txn-store-1-register-1-000182",
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "tray": [],
  "total": 0
}
```

### Combo/meal tray line format
`ringUp` payload `tray` supports both single-item and combo bundle lines.

Single item line:
```json
{
  "id": "1",
  "lineType": "item",
  "itemId": "1",
  "name": "Coffee",
  "qty": 1,
  "basePrice": 3.5,
  "unitPrice": 3.5
}
```

Combo bundle line:
```json
{
  "id": "combo:combo-breakfast",
  "lineType": "combo",
  "comboId": "combo-breakfast",
  "itemIds": ["1", "2"],
  "name": "Breakfast Combo",
  "qty": 1,
  "basePrice": 9.5,
  "unitPrice": 8.5
}
```

Server rule reminder:
- Treat client `tray` and `total` as intent-only values.
- Recompute authoritative totals from inventory/catalog/discount rules server-side.

### `ringUp` callback response contract (required)
Frontend now supports callback-level success/failure responses and applies server-authoritative results.

Success:
```json
{
  "ok": true,
  "data": {
    "tray": [
      {
        "id": "1",
        "lineType": "item",
        "itemId": "1",
        "name": "Coffee",
        "qty": 1,
        "basePrice": 3.5,
        "unitPrice": 2.25
      }
    ],
    "selectedDiscountIds": ["discount-id-1"]
  }
}
```

Validation failure (example):
```json
{
  "ok": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Inventory validation failed.",
    "details": {
      "missingItems": ["Coffee Beans"],
      "insufficientQty": [
        { "itemId": "2", "name": "Bagel", "required": 2, "available": 1 }
      ],
      "comboInvalid": ["combo-breakfast"]
    }
  }
}
```

Failure handling expectation:
- Keep employee in `employee` phase/edit mode.
- Do not mark session rung up.
- Show validation details and allow retry.

- `customerPaid`
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "transactionId": "txn-store-1-register-1-000182",
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "total": 123.45,
  "receiptId": "rcpt-1765000000000-ab12cd",
  "receipt": {
    "id": "rcpt-1765000000000-ab12cd",
    "storeId": "store-1",
    "storeName": "Store 1",
    "registerId": "store-1-register-1",
    "registerName": "Register 1",
    "paidAt": "2026-02-16T21:10:00.000Z",
    "items": [
      {
        "id": "1",
        "name": "Coffee",
        "lineType": "item",
        "itemIds": [],
        "qty": 1,
        "unitPrice": 3.5,
        "lineTotal": 3.5
      }
    ],
    "itemCount": 1,
    "total": 3.5,
    "paymentMethod": "Card"
  }
}
```

Physical receipt integration:
- Use `receipt`/`receiptId` from `customerPaid` to create a paper receipt inventory item.
- Recommended item metadata: `receiptId`, `storeId`, `registerId`, `paidAt`, `total`, `items`.

- `stealMinigameStarted`
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "transactionId": "txn-store-1-register-1-000182",
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "durationMs": 10000
}
```

- `stealMinigameResolved`
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "transactionId": "txn-store-1-register-1-000182",
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "winner": "employee",
  "customerScore": 17,
  "employeeScore": 21
}
```

## FiveM -> Browser messages (SendNUIMessage)
Send messages with `action` and optional `payload`:

- `openRegister`
- `closeRegister`
- `setRole`
- `setView`
- `syncState`

`openRegister` payload:
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "role": "manager",
  "view": "manager",
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "interaction": {
    "businessId": "burgershot",
    "interactionId": "bs-register-zone-1"
  }
}
```

`role` supports:
- `manager`
- `employee`
- `customer`

## Organization membership gate (required for employee/manager UI)
The frontend now enforces that only organization members can access:
- `employee` view/actions
- `manager` view/actions

If membership is not confirmed, UI is restricted to `customer` view even if `role`/`view` says otherwise.

### Preferred backend field
Send this boolean on `openRegister` (and optionally `setRole` / `syncState`):

```json
{
  "isOrganizationMember": true
}
```

### Compatibility with existing server schemas
If your current system uses different names, frontend also accepts:
- booleans: `isOrgMember`, `organizationMember`, `isBusinessMember`
- org identifiers: `organizationId`, `orgId`, `businessId`, `organization.id`
- same keys inside `interaction` or `interactionContext`

If any accepted org identifier is present and non-empty, frontend treats user as a member.

### Recommended payload example (`openRegister`)
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "role": "employee",
  "view": "employee",
  "isOrganizationMember": true,
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "interaction": {
    "businessId": "burgershot",
    "interactionId": "bs-register-zone-1"
  }
}
```

### `syncState` / `setRole` note
For dynamic permission updates while UI is open, include `isOrganizationMember` in:
- `setRole` payload when role/access changes
- `syncState` payload when server rehydrates state

## Server authoritative rules (required)
Treat the frontend as display/input only. The server is authoritative for all business outcomes.

### Authoritative domains
- Totals:
  - Recompute subtotal/total from authoritative catalog pricing and quantities.
  - Apply server-side tax/fees (if used).
- Discounts:
  - Validate discount existence, date window, eligibility, and stacking policy.
  - Ignore client-submitted discount outcomes if they do not match server rules.
- Stock:
  - Validate item existence and available stock at transaction time.
  - Clamp/reject quantities server-side when stock is insufficient.
- Register tiers:
  - Validate current tier, progression prerequisites, and upgrade permission.
  - Reject invalid upgrades with `TIER_NOT_ELIGIBLE`.

### Non-authoritative client data
The following client-submitted fields must be treated as hints only:
- `total`
- calculated discounted prices
- inferred stock availability
- tier upgrade intent

### Required backend decision flow
1. Receive callback payload (`uiSessionId`, `transactionId`, action payload).
2. Validate session, role, org membership, and idempotency.
3. Recompute totals/discounts/stock/tier eligibility from server state.
4. Accept or reject action with a cataloged `error.code` (and `details` for validation failures).
5. Persist authoritative result on success.
6. Return callback result (`ok: true|false`) to the initiating action.
7. Return/emit normalized state via `syncState` when needed.

### Rule of thumb
- Never trust client-submitted totals, discounts, quantities, stock, or tier transitions.
- Always recompute and validate server-side before mutating persistent state.

## Error code catalog
Use machine-readable `error.code` values in callback responses and server logs.

Source of truth:
- `shared/nuiErrorCodes.js`

Both frontend and backend should import from this shared module to avoid drift.

| Code | When to return | Retryable | Typical client behavior |
|---|---|---|---|
| `REGISTER_BUSY` | Register is locked by another active transaction/session | Yes | Show busy message and retry with backoff |
| `INVALID_ROLE` | Role is not recognized or not allowed for attempted action | No | Force to `customer` view or close |
| `NOT_ORG_MEMBER` | Employee/manager action attempted without membership | No | Restrict UI to `customer` |
| `STALE_SESSION` | `uiSessionId` is missing/expired/not active | No | Close UI and reopen from interaction point |
| `STALE_TRANSACTION` | `transactionId` no longer active or already finalized | No | Refresh state, disable action |
| `DUPLICATE_ACTION` | Idempotency key already processed | No | Ignore duplicate and use prior result |
| `INVALID_PAYLOAD` | Missing required fields or wrong data types | No | Show error and log payload |
| `PRICE_MISMATCH` | Client total differs from server recompute | No | Use server total and sync UI |
| `DISCOUNT_INVALID` | Discount expired/ineligible/not allowed | No | Sync discounts from server |
| `INSUFFICIENT_STOCK` | Requested qty exceeds authoritative stock | No | Sync catalog/stock and tray |
| `TIER_NOT_ELIGIBLE` | Upgrade attempted without meeting progression rules | No | Keep current tier, show reason |
| `RATE_LIMITED` | Action spam threshold exceeded | Yes | Temporary lockout, retry later |
| `INTERNAL_ERROR` | Unhandled backend failure | Depends | Show generic error and keep UI stable |

Suggested response shape:
```json
{
  "ok": false,
  "error": {
    "code": "STALE_SESSION",
    "message": "Session expired",
    "retryable": false
  }
}
```

## Versioning and deprecation policy
To avoid breaking older resources, version your contract explicitly.

### Policy
- Add `schemaVersion` to every outbound callback and inbound message payload.
- Only add fields in minor updates; never repurpose existing keys.
- Keep deprecated keys supported for at least 2 release cycles.
- Log a warning when deprecated keys are used, then remove on major version bump.

### Current baseline
- `schemaVersion: 1` (current stable contract).

### Deprecation workflow
1. Introduce new key alongside old key.
2. Support both keys in parser and serializer.
3. Announce deprecation target date/release.
4. Remove old key on next major version.

Example payload fragment:
```json
{
  "schemaVersion": 1,
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "transactionId": "txn-store-1-register-1-000182"
}
```

## Security and anti-abuse notes
Minimum backend protections recommended for production:

- Validate role + membership server-side on every protected action.
- Use register-level locking to prevent concurrent writes to same register state.
- Audit log all rejected actions with player identifier, error code, and IDs.
- Never expose privileged state transitions (tier upgrade, payment finalization) without server checks.

### Recommended rate-limit profile
| Callback group | Suggested limit | Window | Response on exceed |
|---|---|---|---|
| `ringUp`, `enableCustomerActions` | 3 requests | 5 seconds | `RATE_LIMITED` |
| `customerPaid`, `customerStole` | 2 requests | 10 seconds | `RATE_LIMITED` |
| `stealMinigameStarted`, `stealMinigameResolved` | 2 requests | 10 seconds | `RATE_LIMITED` |
| `registerTierUpgraded` | 1 request | 5 seconds | `RATE_LIMITED` |
| Minigame tap/action spam endpoint (if present) | 15 requests | 1 second | `RATE_LIMITED` |

Implementation notes:
- Apply limits per player and per register.
- Add a short cooldown after repeated violations (for example, 10-30 seconds).

### Idempotency key contract
For all state-changing callbacks, compute and persist an idempotency key:

`idempotencyKey = ${uiSessionId}:${transactionId}:${action}`

Rules:
- If the key is new, process request and store final result.
- If the key already exists, do not execute side effects again.
- Return previous result or `DUPLICATE_ACTION`.
- Keep idempotency records for at least the max transaction lifetime (recommended 10-30 minutes).

### Duplicate action protection
Treat these callbacks as single-finalization events per `transactionId`:
- `customerPaid`
- `customerStole`
- `stealMinigameResolved`
- `registerTierUpgraded`

If any of the above is received again for the same transaction:
- Return prior success payload, or
- Return `ok: false` with `error.code = DUPLICATE_ACTION`.

### Replay protection and session expiry
- Apply short TTLs for `uiSessionId` and `transactionId` to prevent replay.
- Reject expired or unknown sessions with `STALE_SESSION`.
- Reject expired or unknown transactions with `STALE_TRANSACTION`.

## Polyzone / prop prototype
Frontend prototype configs live in:

- `src/prototype/businessInteractions.js`

Each interaction point supports:
- `type`: `polyzone` or `prop`
- `registerId`: which register to open
- `businessId`, `id`, `label`
- plus spatial data (`coords`, size/heading/z-range or model/distance)

## Frontend dev mock mode
Set:

```env
VITE_NUI_MOCK=true
```

Then in browser console you can simulate inbound events:

```js
window.dispatchEvent(
  new MessageEvent("message", {
    data: { action: "openRegister", payload: { role: "employee", view: "employee" } },
  }),
);
```

Optional callback mock handler:

```js
window.__NUI_MOCK__ = {
  onPost: async (eventName, payload) => ({ eventName, payload, ok: true }),
};
```

`syncState` can patch:
- `schemaVersion`
- `uiSessionId`
- `activeEventTags` (or `eventTags`)
- `stores`
- `activeStoreId`
- `activeRegisterId`
- `traysByRegister`
- `sessionsByRegister`
- `registerTierByRegister` (or `registerLevelsByRegister`)
- `registerStatsByRegister` (or `statsByRegister`)
- `abuseSignalsByRegister`
- `currentRole`
- `view`

### Scheduled promotions payload shape
Manager-configured discounts/promotions may include optional schedule fields:

```json
{
  "id": "d-happy-hour-1",
  "name": "Happy Hour Drinks",
  "discountType": "percentage",
  "discountValue": 50,
  "applyToAllItems": true,
  "promotionType": "happyHour",
  "startDate": "2026-02-16",
  "endDate": "2026-03-16",
  "startTime": "15:00",
  "endTime": "17:00",
  "weekdays": [1, 2, 3, 4, 5],
  "eventTag": "",
  "itemIds": ["1", "4"]
}
```

Rules:
- `discountType` supports:
  - `percentage` (`discountValue` is percent off, e.g. `50` = 50% off)
  - `fixed` (`discountValue` is final fixed item price)
- `applyToAllItems: true` applies discount to the entire order/catalog scope.
- Legacy `discountPrice` is still accepted as fixed-price compatibility.
- `weekdays` uses JS day index: `0=Sun ... 6=Sat`.
- `startTime`/`endTime` are 24h `HH:mm` (supports overnight windows when end < start).
- `eventTag` requires a matching value in `activeEventTags` / `eventTags` from backend.

### Suspicious activity signal shape (optional)
Frontend can consume server-provided suspicious-signal counters per register:

```json
{
  "abuseSignalsByRegister": {
    "store-1-register-1": {
      "rapidStealEvents": [1760719200000],
      "duplicateActionEvents": [1760719225000, 1760719227000],
      "failedUpgradeEvents": [1760719300000],
      "lastFlaggedAt": "2026-02-16T21:08:20.000Z"
    }
  }
}
```

`registerStatsByRegister` shape example:
```json
{
  "store-1-register-1": {
    "totalSales": 1234.5,
    "totalTransactions": 25,
    "paidTransactions": 21,
    "stolenTransactions": 4,
    "stealAttempts": 7,
    "blockedStealAttempts": 3,
    "itemsSold": 68,
    "itemsStolen": 9,
    "lastPaidTotal": 17.5,
    "lastTransactionAt": "2026-02-14T21:10:00.000Z"
  }
}
```

## Register tier upgrades (business task integration)
Frontend supports 7 register tiers and is ready for backend/business progression hooks.

### Tier map payload
```json
{
  "registerTierByRegister": {
    "store-1-register-1": 1
  }
}
```

Supported inbound keys:
- `registerTierByRegister`
- `registerLevelsByRegister`

### Browser -> FiveM callback (prototype upgrade action)
- `registerTierUpgraded`

Example:
```json
{
  "uiSessionId": "ui-store-1-register-1-20260216T210000Z",
  "transactionId": "txn-store-1-register-1-000182",
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "previousTierLevel": 1,
  "nextTierLevel": 2
}
```

### Tier ladder (L1-L7)
1. `Starter Terminal`: slowest processing, shows processing progress during ring-up.
   - Highest machine error chance (re-ring required on failure).
2. `Refit Terminal`: faster calculation pass.
3. `Shift Pro Register`: smoother discount validation.
   - Adds auto discount assist and +1 employee defense start in food-war.
4. `Service Lane Unit`: reduced ring-up downtime.
   - Shorter steal minigame duration and +2 employee defense start.
5. `Rush Hour Console`: high-volume transaction handling.
   - +3 defense start and 8% instant auto-block chance for steal attempts.
6. `Executive POS`: near-instant checkout flow.
   - +4 defense start and 14% instant auto-block chance.
7. `Quantum Checkout Core`: maximum throughput, lowest machine error chance.
   - +5 defense start and 22% instant auto-block chance.

## QA checklist and test matrix
Use this matrix before promoting integration to production.

### Preflight checklist
- Server emits and validates `uiSessionId` and `transactionId` on all checkout/steal/tier events.
- Callback responses always return `{ ok, error? }` and include cataloged `error.code` when `ok = false`.
- `ringUp` failures include structured validation details when available:
  - `missingItems`, `insufficientQty`, `comboInvalid`
- `syncState` path supports full rehydration (store, register, tray, session, tier, stats).
- Logs include player identifier, `uiSessionId`, `transactionId`, and `error.code`.

### Role and membership access matrix
| Test ID | Role | Membership | Tier | Scenario | Expected result |
|---|---|---|---|---|---|
| `ACC-01` | `customer` | false | L1 | Open register from customer interaction | Customer UI only; no employee/manager controls rendered |
| `ACC-02` | `employee` | false | L1 | Open register with employee role but no org membership | Forced to customer view; protected actions blocked |
| `ACC-03` | `manager` | false | L3 | Open register with manager role but no org membership | Forced to customer view; manager panels hidden |
| `ACC-04` | `employee` | true | L1 | Ring-up then enable customer actions | `ringUp` and `enableCustomerActions` callbacks accepted |
| `ACC-05` | `manager` | true | L2 | Access manager view and edit menu/discounts | Manager controls available; server validates updates |

### Tier behavior matrix
| Test ID | Role | Membership | Tier | Scenario | Expected result |
|---|---|---|---|---|---|
| `TIER-01` | `employee` | true | L1 | Ring-up flow | Processing progress appears; higher machine-error behavior possible |
| `TIER-02` | `employee` | true | L3 | Ring-up with eligible discounts | Auto discount assist behavior applied correctly |
| `TIER-03` | `employee` | true | L5 | Customer steal attempt | Auto-block chance path can emit `stealAttemptAutoBlocked` once |
| `TIER-04` | `manager` | true | L1->L2 | Upgrade register tier | Allowed only when eligibility passes; event emits with correct tier delta |
| `TIER-05` | `manager` | true | L7 | Upgrade attempt at max tier | Rejected with `TIER_NOT_ELIGIBLE`; no client-side tier drift |

### Disconnection and reconnect matrix
| Test ID | Disconnect point | Reconnect path | Expected result |
|---|---|---|---|
| `REC-01` | Before `ringUp` callback | Reopen same register | New `uiSessionId`; old session rejected as `STALE_SESSION` |
| `REC-02` | After `ringUp`, before `customerPaid`/`customerStole` | `syncState` on reconnect | Tray/session restored from server-authoritative state |
| `REC-03` | During steal minigame | `syncState` + timer reconciliation | Minigame resolves authoritatively; stale taps rejected |
| `REC-04` | After payment callback sent, before UI acknowledgement | Retry same action | Server idempotency returns prior result or `DUPLICATE_ACTION` |
| `REC-05` | Server restart while UI open | Fresh `openRegister` + `syncState` | Client recovers cleanly; stale transaction rejected as `STALE_TRANSACTION` or `STALE_SESSION` |

### Reliability and abuse checklist
- Open/close UI rapidly 10+ times:
  - each open gets a unique `uiSessionId`
  - stale IDs are rejected
- Replay identical callback payloads:
  - finalization callbacks are deduped by idempotency key
  - backend returns prior result or `DUPLICATE_ACTION`
- Run concurrent employee actions on one register:
  - register lock prevents dual finalization
  - second actor gets `REGISTER_BUSY`
- Trigger rate-limit conditions:
  - spam actions return `RATE_LIMITED`
  - system recovers without session corruption
- Force invalid payloads:
  - backend rejects with `INVALID_PAYLOAD`
  - no partial state mutation persists

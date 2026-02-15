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

Payload examples:

- `ringUp`
```json
{
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "tray": [],
  "total": 0
}
```

- `customerPaid`
```json
{
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "total": 123.45
}
```

- `stealMinigameStarted`
```json
{
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "durationMs": 10000
}
```

- `stealMinigameResolved`
```json
{
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
- `stores`
- `activeStoreId`
- `activeRegisterId`
- `traysByRegister`
- `sessionsByRegister`
- `registerTierByRegister` (or `registerLevelsByRegister`)
- `registerStatsByRegister` (or `statsByRegister`)
- `currentRole`
- `view`

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
  "storeId": "store-1",
  "registerId": "store-1-register-1",
  "previousTierLevel": 1,
  "nextTierLevel": 2
}
```

### Tier ladder (L1-L7)
1. `Starter Terminal`: slowest processing, shows buffer bar + loading modal during ring-up.
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

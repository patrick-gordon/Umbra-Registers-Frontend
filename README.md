# Umbra Registers Frontend

React/Vite frontend for the Umbra register system used in FiveM NUI.

## Backend Developer Workflow

1. Open UI from interaction:
   - Send `openRegister` via `SendNUIMessage`.
   - Include `role`, `view`, `storeId`, `registerId`.
   - Include org membership (preferred: `isOrganizationMember`).
2. Employee builds tray locally in UI (no server writes yet).
3. Employee presses `Ring Up`:
   - UI emits `ringUp` (intent payload: tray + total).
   - Backend revalidates everything server-side (stock, discounts, combos, totals).
   - Backend returns callback envelope: `{ ok: true, data? }` or `{ ok: false, error }`.
4. If ring-up succeeds, employee presses `Enable Customer Actions`:
   - UI emits `enableCustomerActions`.
5. Customer outcome:
   - pay path: `customerPaid`
   - theft path: `stealAttemptAutoBlocked` or `stealMinigameStarted` -> `customerStole` / `stealMinigameResolved`
6. Server can rehydrate UI at any time with `syncState`.
7. UI closes via `closeRegister` (server->UI) or `close` (UI->server).

## Callback Contract (Critical)

- `ringUp` is a commit step, not display-only.
- Treat `tray` and `total` from UI as intent-only data.
- Return authoritative tray/totals in `ringUp` response when needed:
  - success: `{ ok: true, data: { tray, selectedDiscountIds? } }`
  - failure: `{ ok: false, error: { code, message, details? } }`
- Validation failure details supported by UI:
  - `missingItems`
  - `insufficientQty`
  - `comboInvalid`

## Runtime Notes

- Employee UI remains usable during processing/jam notice states (non-blocking UX).
- Manager view is test-only in browser/dev mode and not exposed in FiveM runtime.

## Integration Docs

- Full end-to-end backend contract and payload examples: `FIVEM_INTEGRATION.md`
- Shared error code source of truth: `shared/nuiErrorCodes.js`

## Backend Checklist

- Emit `openRegister` with: `role`, `view`, `storeId`, `registerId`, `interaction`.
- Include org membership in payloads (preferred key: `isOrganizationMember`).
- Handle `ringUp` as authoritative server validation/commit.
- For callback failures, always return machine-readable `error.code` from `shared/nuiErrorCodes.js`.
- For ring-up validation failures, include `missingItems` / `insufficientQty` / `comboInvalid` when available.
- On `customerPaid`, use `receipt`/`receiptId` payload fields if you want to generate
  a physical paper receipt item and place it into player inventory.
- Send `syncState` for authoritative rehydration as needed.

## Dev Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`

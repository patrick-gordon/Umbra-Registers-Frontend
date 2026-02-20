# Umbra Registers Frontend

React/Vite frontend for the Umbra register system used in FiveM NUI.

## Current Checkout Flow (Implemented)

This project uses an intent-tray checkout flow:

1. Employee builds an intent tray from the Item Picker (items/combos).
2. Employee presses `Ring Up`.
   - UI remains interactive while processing runs.
3. Server validates:
   - required item quantities from player inventory
   - combo eligibility
   - discount and tier effects
4. If valid:
   - server consumes inventory
   - server returns authoritative tray totals (and optional selected discounts)
   - frontend marks session as rung up
5. If invalid:
   - server returns `ok: false` with structured details (`missingItems`, `insufficientQty`, `comboInvalid`)
   - frontend keeps employee in edit mode and shows the validation failure
6. Employee adjusts tray and retries.
7. On successful ring-up, employee enables customer actions.

## Runtime Notes

- Employee UI remains usable during processing/jam notice states (non-blocking UX).
- Manager view is test-only in browser/dev mode and not exposed in FiveM runtime.

## Integration Docs

- Full FiveM contract and payload examples: `FIVEM_INTEGRATION.md`
- Shared error code source of truth: `shared/nuiErrorCodes.js`

## Backend Checklist

- Emit `openRegister` with: `role`, `view`, `storeId`, `registerId`, `interaction`.
- Include org membership in payloads (preferred key: `isOrganizationMember`).
- Handle `ringUp` as a commit step, not a display update:
  - treat `tray`/`total` from UI as intent only
  - revalidate inventory/combo/discount/tier server-side
  - return callback response in one of these forms:
    - success: `{ ok: true, data: { tray, selectedDiscountIds? } }`
    - failure: `{ ok: false, error: { code, message, details? } }`
- For validation failures, include structured details when available:
  - `missingItems: string[] | object[]`
  - `insufficientQty: object[]`
  - `comboInvalid: string[] | object[]`
- On `customerPaid`, use `receipt`/`receiptId` payload fields if you want to generate
  a physical paper receipt item and place it into player inventory.
- Send `syncState` for authoritative rehydration as needed.

## Dev Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`

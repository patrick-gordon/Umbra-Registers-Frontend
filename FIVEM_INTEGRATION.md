# FiveM NUI Integration

## Browser -> FiveM callbacks (POST)
The UI calls these NUI callbacks on your resource:

- `close`
- `ringUp`
- `enableCustomerActions`
- `customerPaid`
- `customerStole`

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
- `currentRole`
- `view`

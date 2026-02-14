export default function ItemGrid({ items, tray, onAdd, disabled = false }) {
  return (
    <div style={{ flex: 1 }}>
      <h2>Items</h2>

      {items.map((item) => {
        const trayItem = tray.find((t) => t.id === item.id);
        const qtyInTray = trayItem?.qty ?? 0;
        const outOfStock = qtyInTray >= item.stock;

        return (
          <div key={item.id} style={{ marginBottom: 10 }}>
            <button onClick={() => onAdd(item.id)} disabled={outOfStock || disabled}>
              {item.name} - ${item.effectivePrice.toFixed(2)} ({item.stock} in stock)
            </button>
            {item.hasDiscount && (
              <span style={{ marginLeft: 8 }}>Regular: ${item.price.toFixed(2)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

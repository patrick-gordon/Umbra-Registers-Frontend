export default function ItemGrid({ items, onAdd, disabled = false }) {
  return (
    <div style={{ flex: 1 }}>
      <h2>Items</h2>

      {items.map((item) => {
        return (
          <div key={item.id} style={{ marginBottom: 10 }}>
            <button onClick={() => onAdd(item.id)} disabled={disabled}>
              {item.name} - ${item.effectivePrice.toFixed(2)}
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

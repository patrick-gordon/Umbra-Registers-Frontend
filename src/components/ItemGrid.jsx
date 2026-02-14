export default function ItemGrid({ items, onAdd }) {
  return (
    <div style={{ flex: 1 }}>
      <h2>Items</h2>

      {items.map(item => (
        <div key={item.id} style={{ marginBottom: 10 }}>
          <button onClick={() => onAdd(item)}>
            {item.name} - ${item.price}
          </button>
        </div>
      ))}
    </div>
  );
}

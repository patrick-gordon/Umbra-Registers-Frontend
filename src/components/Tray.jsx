export default function Tray({ tray, onAdd, onDecrease, onRemove }) {
  const total = tray.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div style={{ flex: 1 }}>
      <h2>Tray</h2>

      {tray.length === 0 && <p>No items yet</p>}

      {tray.map((item) => (
        <div key={item.id} style={{ marginBottom: 10 }}>
          {item.name}

          <button onClick={() => onDecrease(item.id)}>−</button>

          <span style={{ margin: "0 10px" }}>{item.qty}</span>

          <button onClick={() => onAdd(item)}>+</button>

          <button onClick={() => onRemove(item.id)} style={{ marginLeft: 10 }}>
            Remove
          </button>
        </div>
      ))}

      <h3>Total: ${total.toFixed(2)}</h3>
    </div>
  );
}

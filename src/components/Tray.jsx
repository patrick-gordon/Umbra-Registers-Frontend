export default function Tray({
  tray,
  onAdd,
  onDecrease,
  onRemove,
  onCheckout,
  controlsDisabled = false,
  showCheckout = true,
  checkoutLabel = "Checkout",
}) {
  const total = tray.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);

  return (
    <div style={{ flex: 1 }}>
      <h2>Tray</h2>

      {tray.length === 0 && <p>No items yet</p>}

      {tray.map((item) => (
        <div key={item.id} style={{ marginBottom: 10 }}>
          {item.name}

          <button onClick={() => onDecrease(item.id)} disabled={controlsDisabled}>
            -
          </button>

          <span style={{ margin: "0 10px" }}>{item.qty}</span>

          <button onClick={() => onAdd(item.id)} disabled={controlsDisabled}>
            +
          </button>

          <button
            onClick={() => onRemove(item.id)}
            style={{ marginLeft: 10 }}
            disabled={controlsDisabled}
          >
            Remove
          </button>

          <span style={{ marginLeft: 10 }}>
            ${item.unitPrice.toFixed(2)} each
          </span>
        </div>
      ))}

      <h3>Total: ${total.toFixed(2)}</h3>

      {showCheckout && (
        <button onClick={onCheckout} disabled={tray.length === 0 || controlsDisabled}>
          {checkoutLabel}
        </button>
      )}
    </div>
  );
}

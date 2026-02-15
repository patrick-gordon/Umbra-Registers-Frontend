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
        <div
          key={item.id}
          style={{
            marginBottom: 8,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 32px 34px 32px 74px 96px",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span
            title={item.name}
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </span>

          <button onClick={() => onDecrease(item.id)} disabled={controlsDisabled}>
            -
          </button>

          <span style={{ textAlign: "center" }}>{item.qty}</span>

          <button onClick={() => onAdd(item.id)} disabled={controlsDisabled}>
            +
          </button>

          <button onClick={() => onRemove(item.id)} disabled={controlsDisabled}>
            Remove
          </button>

          <span style={{ textAlign: "right" }}>${item.unitPrice.toFixed(2)} each</span>
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

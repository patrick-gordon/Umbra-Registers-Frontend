import { useEffect, useState } from "react";
import { useRegisterStore } from "../context/RegisterContext";

function CustomerActions({ tray, total, onPay, onSteal, canSteal }) {
  return (
    <div className="view-card is-open">
      <div className="section-header">
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>Customer Checkout</h3>
        <span className="section-tag">Ready</span>
      </div>
      <p className="view-note section-subtitle">
        Review your order and complete payment.
      </p>

      <div className="customer-checkout-grid">
        <div className="customer-checkout-block">
          <h4>Order Items</h4>
          {tray.length > 0 ? (
            <div className="customer-order-list">
              {tray.map((item) => (
                <div key={item.id} className="customer-order-row">
                  <span className="customer-order-name" title={item.name}>
                    {item.name} x{item.qty}
                  </span>
                  <strong>${(item.unitPrice * item.qty).toFixed(2)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="view-note">No items on this order yet.</p>
          )}
        </div>

        <div className="customer-checkout-block">
          <h4>Total Due</h4>
          <p className="customer-total-amount">${total.toFixed(2)}</p>
          <div className="customer-action-row">
            <button onClick={onPay}>Pay</button>
            <button onClick={onSteal} disabled={!canSteal}>
              {canSteal ? "Steal Food" : "Steal Attempt Used"}
            </button>
          </div>
        </div>
      </div>
      {!canSteal && (
        <p style={{ marginTop: 8, marginBottom: 0, color: "var(--umbra-accent-2)" }}>
          Theft was already blocked for this order.
        </p>
      )}
    </div>
  );
}

function StealMinigame({ stealMinigame, onTap }) {
  const [now, setNow] = useState(Date.now());
  const msLeft = Math.max(0, (stealMinigame?.endsAt ?? 0) - now);
  const secondsLeft = (msLeft / 1000).toFixed(1);
  const customerScore = stealMinigame?.customerScore ?? 0;
  const employeeScore = stealMinigame?.employeeScore ?? 0;
  const total = customerScore + employeeScore;
  const advantage = total > 0 ? (customerScore - employeeScore) / total : 0;
  const markerPosition = 50 + advantage * 45;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.code !== "KeyE" && event.key.toLowerCase() !== "e") return;
      onTap();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTap]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="view-card is-open">
      <div className="section-header">
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>Steal Minigame</h3>
        <span className="section-tag">Mash E</span>
      </div>
      <p className="view-note">Press E repeatedly to pull the bar to your side.</p>
      <p className="view-note">Time Left: {secondsLeft}s</p>
      <div className="tug-track">
        <div className="tug-track-fill" />
        <div className="tug-track-marker" style={{ left: `${markerPosition}%` }} />
      </div>
      <p style={{ marginTop: 8, marginBottom: 0, color: "var(--umbra-muted)" }}>
        Left = Employee wins, Right = Customer wins
      </p>
    </div>
  );
}

export default function CustomerView() {
  const { state, actions } = useRegisterStore();

  return (
    <div className="view-shell view-shell--compact view-layout">
      <h2 style={{ marginTop: 0, textAlign: "center" }}>
        {state.activeStoreName} - {state.registerName}
      </h2>

      {state.session.phase === "customer" ? (
        <CustomerActions
          tray={state.tray}
          total={state.total}
          onPay={actions.onCustomerPay}
          onSteal={actions.onCustomerSteal}
          canSteal={state.session.stealMinigame?.winner !== "employee"}
        />
      ) : state.session.phase === "stealMinigame" ? (
        <StealMinigame
          stealMinigame={state.session.stealMinigame}
          onTap={actions.onStealMinigameTap}
        />
      ) : (
        <div className="view-card is-open customer-empty-state">
          <div className="customer-empty-glyph" aria-hidden="true">
            UT
          </div>
          <div>
            <h3 style={{ margin: 0 }}>Welcome to {state.activeStoreName}</h3>
            <p className="view-note" style={{ marginTop: 8, marginBottom: 0 }}>
              Your order appears here once an employee starts the transaction.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import MinigameResultModal from "./MinigameResultModal";
import DraggablePanel from "./DraggablePanel";
import { useRegisterStore } from "../context/useRegisterStore";

function CustomerActions({ tray, total, onPay, onSteal, canSteal, isProcessing, nuiError }) {
  const hasReconnectIssue = /^\[(TIMEOUT|FETCH_ERROR|HTTP_ERROR)\]/.test(String(nuiError ?? ""));
  const checkoutStatus = hasReconnectIssue
    ? { tone: "reconnect", label: "Reconnect" }
    : isProcessing
      ? { tone: "loading", label: "Loading" }
      : tray.length === 0
        ? { tone: "empty", label: "Empty" }
        : canSteal
          ? { tone: "ready", label: "Ready" }
          : { tone: "disabled", label: "Locked" };
  const lineCount = tray.reduce((count, item) => count + (item.qty ?? 0), 0);

  return (
    <div className="view-card is-open">
      <div className="section-header">
        <h3 className="card-title">Customer Checkout</h3>
        <span className={`section-tag ds-status ds-status--${checkoutStatus.tone}`}>
          {checkoutStatus.label}
        </span>
      </div>
      <p className="view-note ds-card-meta-row">
        <span>Current order</span>
        <strong>
          {lineCount} item(s) | ${total.toFixed(2)}
        </strong>
      </p>

      <div className="customer-checkout-grid">
        <div className="customer-checkout-block">
          <h4>Order Items</h4>
          {tray.length > 0 ? (
            <div className="customer-order-list">
              {tray.map((item) => {
                const baseUnitPrice = Number(item.basePrice ?? item.unitPrice);
                const unitPrice = Number(item.unitPrice ?? 0);
                const hasAppliedDiscount = baseUnitPrice > unitPrice;

                return (
                  <div key={item.id} className="customer-order-row">
                    <div className="customer-order-main">
                      <span className="customer-order-name" title={item.name}>
                        {item.name} x{item.qty}
                      </span>
                      {hasAppliedDiscount && (
                        <span className="customer-order-discount">
                          Discounted ${baseUnitPrice.toFixed(2)}{" -> "}$
                          {unitPrice.toFixed(2)} each
                        </span>
                      )}
                    </div>
                    <strong>${(unitPrice * item.qty).toFixed(2)}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="view-note ds-state-row ds-state--empty">No items on this order yet.</p>
          )}
        </div>

        <div className="customer-checkout-block">
          <h4>Total Due</h4>
          <p className="customer-total-amount">${total.toFixed(2)}</p>
          <div className="customer-action-row">
            <button type="button" className="btn-primary customer-pay-btn ds-card-cta" onClick={onPay}>
              Pay
            </button>
            <button type="button" className="btn-secondary customer-steal-btn" onClick={onSteal} disabled={!canSteal}>
              {canSteal ? "Steal Food" : "Steal Attempt Used"}
            </button>
          </div>
        </div>
      </div>
      {!canSteal && (
        <p className="view-alert ds-state-row ds-state--disabled">
          Theft was already blocked for this order.
        </p>
      )}
    </div>
  );
}

function StealMinigame({ stealMinigame, onTap }) {
  const [now, setNow] = useState(stealMinigame?.endsAt ?? 0);
  const msLeft = Math.max(0, (stealMinigame?.endsAt ?? 0) - now);
  const secondsLeft = (msLeft / 1000).toFixed(1);
  const customerScore = stealMinigame?.customerScore ?? 0;
  const employeeScore = stealMinigame?.employeeScore ?? 0;
  const total = customerScore + employeeScore;
  const advantage = total > 0 ? (customerScore - employeeScore) / total : 0;
  const markerPosition = 50 + advantage * 45;

  useEffect(() => {
    // Shared steal minigame keybind for customer side.
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.code !== "KeyE" && event.key.toLowerCase() !== "e") return;
      onTap("customer");
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
        <h3 className="card-title">Steal Minigame</h3>
        <span className="section-tag ds-status ds-status--loading">Active</span>
      </div>
      <p className="view-note ds-card-meta-row">
        <span>Time left</span>
        <strong>{secondsLeft}s</strong>
      </p>
      <p className="view-note">Press E repeatedly to pull the bar to your side.</p>
      <div className="tug-track">
        <div className="tug-track-fill" />
        <div className="tug-track-marker" style={{ left: `${markerPosition}%` }} />
      </div>
      <p className="view-caption">
        Left = Employee wins, Right = Customer wins
      </p>
      <button type="button" className="btn-primary ds-card-cta" onClick={() => onTap("customer")}>
        Tap Steal
      </button>
    </div>
  );
}

function CustomerReceipt({ receipt, onDismiss }) {
  const paidAtLabel = receipt.paidAt
    ? new Date(receipt.paidAt).toLocaleString()
    : "Unknown";

  return (
    <div className="view-card is-open customer-receipt-card">
      <div className="section-header">
        <h3 className="card-title">Payment Complete</h3>
        <span className="section-tag ds-status ds-status--ready">Receipt</span>
      </div>
      <p className="view-note ds-card-meta-row">
        <span>Receipt #{receipt.id}</span>
        <strong>{paidAtLabel}</strong>
      </p>

      <div className="customer-receipt-list">
        {receipt.items.map((item) => (
          <div key={item.id} className="customer-receipt-row">
            <span className="customer-receipt-name" title={item.name}>
              {item.name} x{item.qty}
            </span>
            <strong>${item.lineTotal.toFixed(2)}</strong>
          </div>
        ))}
      </div>

      <div className="customer-receipt-footer">
        <span>{receipt.itemCount} item(s)</span>
        <strong>Total Paid: ${receipt.total.toFixed(2)}</strong>
      </div>

      <div className="customer-action-row">
        <button type="button" className="btn-primary ds-card-cta" onClick={onDismiss}>
          Done
        </button>
      </div>
    </div>
  );
}

export default function CustomerView() {
  const { state, actions } = useRegisterStore();
  const isDetachedLayout = state.view === "customer";
  // Only show receipt after transaction settles and tray has been cleared/reset.
  const canShowReceipt =
    Boolean(state.customerReceipt) &&
    state.session.phase !== "customer" &&
    state.session.phase !== "stealMinigame" &&
    !state.session.isProcessing &&
    state.tray.length === 0;

  return (
    <div className="view-shell view-shell--compact view-layout customer-view-shell">
      <DraggablePanel
        enabled={isDetachedLayout}
        panelId="customer-main-panel"
        panelWidth="420px"
        defaultOffset={{ x: 0, y: 0 }}
      >
        {/* Customer phase renderer intentionally keyed off session.phase, not selected tab/view. */}
        {state.session.phase === "customer" ? (
          <CustomerActions
            tray={state.tray}
            total={state.total}
            onPay={actions.onCustomerPay}
            onSteal={actions.onCustomerSteal}
            canSteal={state.session.stealMinigame?.winner !== "employee"}
            isProcessing={state.session.isProcessing}
            nuiError={state.nuiError}
          />
        ) : state.session.phase === "stealMinigame" ? (
          <StealMinigame
            stealMinigame={state.session.stealMinigame}
            onTap={actions.onStealMinigameTap}
          />
        ) : canShowReceipt ? (
          <CustomerReceipt
            receipt={state.customerReceipt}
            onDismiss={actions.onDismissCustomerReceipt}
          />
        ) : (
          <div className="view-card is-open customer-empty-state">
            <div className="customer-empty-glyph" aria-hidden="true">
              UT
            </div>
            <div>
              <h3 className="card-title">Welcome to {state.activeStoreName}</h3>
              <p className="section-tag ds-status ds-status--empty">Empty</p>
              <p className="view-note view-note--compact">
                Your order appears here once an employee starts the transaction.
              </p>
            </div>
          </div>
        )}
      </DraggablePanel>
      {state.minigameResult && (
        <MinigameResultModal
          result={state.minigameResult}
          onDismiss={actions.onDismissMinigameResult}
        />
      )}
    </div>
  );
}

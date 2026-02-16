import { useEffect, useState } from "react";
import { useRegisterStore } from "../context/useRegisterStore";

function EmployeeActions({
  availableSessionDiscounts,
  selectedDiscountIds,
  onToggleDiscount,
  onRingUp,
  onConfirm,
  onClearTransaction,
  hasTrayItems,
  canConfirm,
  canClearTransaction,
  isProcessing,
  processingProgress,
  activeRegisterTier,
  processingError,
}) {
  const isTierOne = activeRegisterTier?.level === 1;
  const perks = [];
  if (activeRegisterTier?.autoDiscountAssist) perks.push("Auto Discount Assist");
  if ((activeRegisterTier?.employeeDefenseBonus ?? 0) > 0) {
    perks.push(`Theft Defense +${activeRegisterTier.employeeDefenseBonus}`);
  }
  if ((activeRegisterTier?.instantStealBlockChance ?? 0) > 0) {
    perks.push(
      `Auto Block ${(activeRegisterTier.instantStealBlockChance * 100).toFixed(0)}%`,
    );
  }

  return (
    <div className="view-card is-open employee-actions-card">
      <div className="section-header">
        <h3 className="card-title">Employee Actions</h3>
        <span className="section-tag employee-actions-tag">Checkout Flow</span>
      </div>
      <p className="view-note view-note--compact">
        Register: L{activeRegisterTier?.level ?? 1} {activeRegisterTier?.name}
      </p>
      <p className="view-note section-subtitle">
        Build tray, apply discounts, ring up, then enable customer actions.
      </p>
      {perks.length > 0 && (
        <div className="employee-perk-row">
          {perks.map((perk) => (
            <span key={perk}>{perk}</span>
          ))}
        </div>
      )}
      {isProcessing && isTierOne && (
        <div className="employee-buffer-wrap">
          <p className="view-note">Calculating totals... {processingProgress}%</p>
          <div className="employee-buffer-track">
            <div
              className="employee-buffer-fill"
              style={{ width: `${Math.min(100, Math.max(0, processingProgress))}%` }}
            />
          </div>
        </div>
      )}
      {processingError && (
        <p className="employee-processing-error">{processingError}</p>
      )}
      <div className="employee-discount-list employee-actions-discounts">
        {availableSessionDiscounts.length === 0 && (
          <span className="view-note employee-actions-empty">No available discounts.</span>
        )}
        {availableSessionDiscounts.map((discount) => (
          <label key={discount.id} className="employee-discount-chip">
            <input
              type="checkbox"
              checked={selectedDiscountIds.includes(discount.id)}
              onChange={() => onToggleDiscount(discount.id)}
            />
            {discount.name}
          </label>
        ))}
      </div>
      <div className="employee-action-row employee-action-row--compact">
        <button type="button" onClick={onRingUp} disabled={!hasTrayItems || isProcessing}>
          Ring Up
        </button>
        <button type="button" onClick={onConfirm} disabled={!canConfirm || isProcessing}>
          Enable Customer Actions
        </button>
        <button
          type="button"
          className="button-danger"
          onClick={onClearTransaction}
          disabled={!canClearTransaction || isProcessing}
        >
          Clear Transaction
        </button>
      </div>
    </div>
  );
}

function ComboBuilder({ combos, onAddCombo }) {
  return (
    <div className="view-card employee-combo-card">
      <div className="section-header">
        <h3 className="card-title">Meal Combos</h3>
        <span className="section-tag">Bundle Pricing</span>
      </div>
      <p className="view-note section-subtitle">
        Add prebuilt meals with automatic bundle pricing.
      </p>
      {combos.length === 0 ? (
        <p className="view-note view-note--compact">No combos configured.</p>
      ) : (
        <div className="employee-combo-list">
          {combos.map((combo) => (
            <button
              key={combo.id}
              type="button"
              className="employee-combo-chip"
              onClick={() => onAddCombo(combo.id)}
              disabled={!combo.isInStock}
            >
              <span className="employee-combo-chip-title">
                {combo.name}
              </span>
              <span className="employee-combo-chip-items">
                {combo.itemNames.join(" + ")}
              </span>
              <strong>${combo.bundlePrice.toFixed(2)}</strong>
              {combo.savings > 0 && (
                <span className="employee-combo-chip-savings">
                  Save ${combo.savings.toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderBreakdown({ tray, total, onIncrease, onDecrease, onRemove, isRungUp }) {
  return (
    <div className="view-card is-open employee-card-compact">
      <div className="section-header">
        <h3 className="card-title">Order Breakdown</h3>
        <span className={`section-tag ${isRungUp ? "is-good" : ""}`}>
          {isRungUp ? "Rung Up" : "Pending"}
        </span>
      </div>
      {tray.length === 0 ? (
        <p className="view-note view-note--compact">
          No items added yet.
        </p>
      ) : (
        <div className="employee-breakdown-list">
          {tray.map((item) => (
            <div key={item.id} className="employee-breakdown-row">
              <span title={item.name} className="employee-item-name">
                {item.name}
                {item.lineType === "combo" && (
                  <span className="employee-line-meta">Combo</span>
                )}
              </span>
              <button type="button" className="employee-qty-btn" onClick={() => onDecrease(item.id)}>
                -
              </button>
              <span className="employee-qty-value">{item.qty}</span>
              <button type="button" className="employee-qty-btn" onClick={() => onIncrease(item.id)}>
                +
              </button>
              <button type="button" className="employee-remove-btn" onClick={() => onRemove(item.id)}>
                Remove
              </button>
              <strong className="employee-line-total">
                ${(item.unitPrice * item.qty).toFixed(2)}
              </strong>
            </div>
          ))}
          <div className="employee-breakdown-footer">
            <span className="view-note">{isRungUp ? "Rung up" : "Not rung up"}</span>
            <strong>Total: ${total.toFixed(2)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function StealDefensePanel({ stealMinigame, onTap }) {
  const [now, setNow] = useState(stealMinigame?.endsAt ?? 0);
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
        <h3 className="card-title">Theft Defense</h3>
        <span className="section-tag">Mash E</span>
      </div>
      <p className="view-note">Press E repeatedly to block theft.</p>
      <p className="view-note">Time Left: {secondsLeft}s</p>
      <div className="tug-track">
        <div className="tug-track-fill" />
        <div className="tug-track-marker" style={{ left: `${markerPosition}%` }} />
      </div>
    </div>
  );
}

export default function EmployeeView() {
  const { state, actions } = useRegisterStore();

  return (
    <div className="view-shell view-shell--compact view-layout">
      <h2 className="view-page-title">
        {state.activeStoreName} - {state.registerName}
      </h2>

      {state.session.phase === "employee" && (
        <div className="view-grid-two employee-top-grid">
          <div className="employee-panel-stack">
            <div className="view-card is-open employee-card-compact">
              <div className="section-header">
                <h3 className="card-title">Item Picker</h3>
                <span className="section-tag">Menu</span>
              </div>
              <p className="view-note section-subtitle">
                Select menu items to build the tray before ringing up.
              </p>
              <div className="employee-item-picker">
                {state.customerItems.map((item) => {
                  const remainingStock = state.remainingStockByItemId[item.id] ?? item.stock;
                  const outOfStock = remainingStock <= 0;
                  return (
                    <button
                      key={item.id}
                      className="employee-item-chip"
                      type="button"
                      onClick={() => actions.onAddToTray(item.id)}
                      disabled={outOfStock}
                    >
                      <span>{item.name}</span>
                      <strong>${item.effectivePrice.toFixed(2)}</strong>
                      <small>{remainingStock} left</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <ComboBuilder
              combos={state.availableCombos}
              onAddCombo={actions.onAddComboToTray}
            />
          </div>

          <OrderBreakdown
            tray={state.tray}
            total={state.total}
            onIncrease={actions.onIncreaseTrayLine}
            onDecrease={actions.onDecreaseTrayItem}
            onRemove={actions.onRemoveTrayItem}
            isRungUp={state.session.isRungUp}
          />
        </div>
      )}

      {state.session.phase === "stealMinigame" ? (
        <StealDefensePanel
          stealMinigame={state.session.stealMinigame}
          onTap={actions.onStealMinigameTap}
        />
      ) : (
        <EmployeeActions
          availableSessionDiscounts={state.availableSessionDiscounts}
          selectedDiscountIds={state.session.selectedDiscountIds}
          onToggleDiscount={actions.onToggleSessionDiscount}
          onRingUp={actions.onRingUp}
          onConfirm={actions.onConfirmCustomerActions}
          onClearTransaction={actions.onClearTransaction}
          hasTrayItems={state.tray.length > 0}
          canConfirm={state.session.isRungUp}
          canClearTransaction={
            state.tray.length > 0 ||
            state.session.isRungUp ||
            state.session.selectedDiscountIds.length > 0 ||
            state.session.phase !== "employee"
          }
          isProcessing={state.session.isProcessing}
          processingProgress={state.session.processingProgress}
          activeRegisterTier={state.activeRegisterTier}
          processingError={state.session.processingError}
        />
      )}
    </div>
  );
}

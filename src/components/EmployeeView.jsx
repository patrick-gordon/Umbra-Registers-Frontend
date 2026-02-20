import { useEffect, useState } from "react";
import MinigameResultModal from "./MinigameResultModal";
import DraggablePanel from "./DraggablePanel";
import { useRegisterStore } from "../context/useRegisterStore";

function ProcessingIssueModal({
  message,
  onRetry,
  onDismiss,
  canRetry,
  isRetrying,
}) {
  const normalizedMessage = String(message ?? "");
  const isJamIssue = normalizedMessage.toLowerCase().includes("jam");
  const title = isJamIssue ? "Register Jam Detected" : "Ring Up Interrupted";
  const hint = isJamIssue
    ? "Clear the scanner path, then press Ring Up to try again."
    : "Please review the order and try again.";

  useEffect(() => {
    // Keep jam/interruption notice dismissible via keyboard like other overlays.
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div className="employee-processing-overlay" role="presentation">
      <div
        className="employee-processing-modal"
        role="alertdialog"
        aria-live="assertive"
        aria-label={title}
      >
        <div className="employee-processing-modal-head">
          <div className="employee-processing-modal-icon" aria-hidden="true">
            !
          </div>
          <button type="button" onClick={onDismiss} className="employee-processing-close">
            Dismiss
          </button>
        </div>
        <div className="employee-processing-modal-content">
          <p className="employee-processing-modal-title">{title}</p>
          <p className="employee-processing-modal-message">{normalizedMessage}</p>
          <p className="employee-processing-modal-hint">{hint}</p>
        </div>
        <div className="employee-processing-modal-actions">
          <button
            type="button"
            className="employee-processing-retry"
            onClick={onRetry}
            disabled={!canRetry || isRetrying}
          >
            Retry Ring Up
          </button>
          <button type="button" onClick={onDismiss}>
            Close
          </button>
        </div>
        <div className="employee-processing-modal-sheen" aria-hidden="true" />
      </div>
    </div>
  );
}

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
  const describeDiscount = (discount) => {
    const discountType =
      discount.discountType === "fixed" || discount.discountType === "percentage"
        ? discount.discountType
        : Number.isFinite(Number(discount.discountPercent))
          ? "percentage"
          : "fixed";
    const rawValue = Number(
      discount.discountValue ??
      (discountType === "percentage" ? discount.discountPercent : discount.discountPrice),
    );
    const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
    const valueLabel =
      discountType === "percentage"
        ? `${safeValue.toFixed(0)}% off`
        : `$${safeValue.toFixed(2)} fixed`;
    const scopeLabel = discount.applyToAllItems
      ? "All items"
      : `${discount.itemIds?.length ?? 0} item scope`;
    return { valueLabel, scopeLabel };
  };

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
        // Tier 1 has the most visible ring-up delay; show progress inline, not as a hard lock.
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
      <div className="employee-discount-list employee-actions-discounts">
        {availableSessionDiscounts.length === 0 && (
          <span className="view-note employee-actions-empty">No available discounts.</span>
        )}
        {availableSessionDiscounts.map((discount) => {
          const isSelected = selectedDiscountIds.includes(discount.id);
          const { valueLabel, scopeLabel } = describeDiscount(discount);
          return (
            <button
              key={discount.id}
              type="button"
              className={`employee-discount-tile ${isSelected ? "is-selected" : ""}`}
              onClick={() => onToggleDiscount(discount.id)}
              aria-pressed={isSelected}
              disabled={isProcessing}
            >
              <span className="employee-discount-title-row">
                <span className="employee-discount-name" title={discount.name}>
                  {discount.name}
                </span>
                <span className={`employee-discount-state ${isSelected ? "is-selected" : ""}`}>
                  {isSelected ? "Selected" : "Select"}
                </span>
              </span>
              <span className="employee-discount-meta">
                <strong>{valueLabel}</strong>
                <span>{scopeLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="employee-action-row employee-action-row--compact">
        <button
          type="button"
          className="employee-action-btn employee-action-btn--ring"
          onClick={onRingUp}
          disabled={!hasTrayItems || isProcessing || canConfirm}
        >
          Ring Up
        </button>
        <button
          type="button"
          className="employee-action-btn employee-action-btn--confirm"
          onClick={onConfirm}
          disabled={!canConfirm || isProcessing}
        >
          Enable Customer Actions
        </button>
        <button
          type="button"
          className="employee-action-btn employee-action-btn--cancel"
          onClick={onClearTransaction}
          disabled={!canClearTransaction}
        >
          Cancel Transaction
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
              className="employee-item-chip employee-combo-chip"
              onClick={() => onAddCombo(combo.id)}
              title={combo.itemNames.join(" + ")}
            >
              <span>{combo.name}</span>
              <strong>${combo.bundlePrice.toFixed(2)}</strong>
              <small>
                {combo.savings > 0
                  ? `Save $${combo.savings.toFixed(2)}`
                  : `${combo.itemNames.length} item bundle`}
              </small>
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
          {tray.map((item) => {
            const baseUnitPrice = Number(item.basePrice ?? item.unitPrice);
            const unitPrice = Number(item.unitPrice ?? 0);
            const hasAppliedDiscount =
              Number.isFinite(baseUnitPrice) &&
              baseUnitPrice > unitPrice;

            return (
              <div key={item.id} className="employee-breakdown-row">
                <div className="employee-item-main">
                  <span title={item.name} className="employee-item-name">
                    {item.name}
                  </span>
                  <div className="employee-line-flags">
                    {item.lineType === "combo" && (
                      <span className="employee-line-meta">Combo</span>
                    )}
                    <span className="employee-line-unit">${unitPrice.toFixed(2)} each</span>
                    {hasAppliedDiscount && (
                      <span className="employee-line-discount">
                        Was ${baseUnitPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="employee-line-side">
                  <strong className="employee-line-total">
                    ${(unitPrice * item.qty).toFixed(2)}
                  </strong>
                  <div className="employee-line-controls">
                    <button
                      type="button"
                      className="employee-qty-btn"
                      onClick={() => onDecrease(item.id)}
                      aria-label={`Decrease ${item.name}`}
                    >
                      -
                    </button>
                    <span className="employee-qty-value">{item.qty}</span>
                    <button
                      type="button"
                      className="employee-qty-btn"
                      onClick={() => onIncrease(item.id)}
                      aria-label={`Increase ${item.name}`}
                    >
                      +
                    </button>
                    <button type="button" className="employee-remove-btn" onClick={() => onRemove(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
    // Shared steal minigame keybind for employee side.
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.code !== "KeyE" && event.key.toLowerCase() !== "e") return;
      onTap("employee");
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
  const isDetachedLayout = state.view === "employee";
  // Ring-up errors are surfaced as a non-blocking notice so tray/actions remain visible.
  const showProcessingIssue =
    state.session.phase === "employee" && Boolean(state.session.processingError);

  return (
    <div className="view-shell view-shell--compact view-layout employee-view-shell">
      {state.session.phase === "employee" && (
        <div className="employee-layout-stack">
          <DraggablePanel
            enabled={isDetachedLayout}
            panelId="employee-item-picker"
            panelWidth="300px"
            defaultOffset={{ x: -450, y: 0 }}
          >
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
                  return (
                    <button
                      key={item.id}
                      className="employee-item-chip"
                      type="button"
                      onClick={() => actions.onAddToTray(item.id)}
                    >
                      <span>{item.name}</span>
                      <strong>${item.effectivePrice.toFixed(2)}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </DraggablePanel>

          <DraggablePanel
            enabled={isDetachedLayout}
            panelId="employee-combo-builder"
            panelWidth="300px"
            defaultOffset={{ x: -150, y: 0 }}
          >
            <ComboBuilder
              combos={state.availableCombos}
              onAddCombo={actions.onAddComboToTray}
            />
          </DraggablePanel>

          <DraggablePanel
            enabled={isDetachedLayout}
            panelId="employee-order-breakdown"
            panelWidth="300px"
            defaultOffset={{ x: 150, y: 0 }}
          >
            <OrderBreakdown
              tray={state.tray}
              total={state.total}
              onIncrease={actions.onIncreaseTrayLine}
              onDecrease={actions.onDecreaseTrayItem}
              onRemove={actions.onRemoveTrayItem}
              isRungUp={state.session.isRungUp}
            />
          </DraggablePanel>
        </div>
      )}

      {state.session.phase === "stealMinigame" ? (
        <DraggablePanel
          enabled={isDetachedLayout}
          panelId="employee-steal-defense"
          panelWidth="340px"
          defaultOffset={{ x: 0, y: 0 }}
        >
          <StealDefensePanel
            stealMinigame={state.session.stealMinigame}
            onTap={actions.onStealMinigameTap}
          />
        </DraggablePanel>
      ) : (
        // Action panel stays available in employee phase even while processing/jam messages exist.
        <DraggablePanel
          enabled={isDetachedLayout}
          panelId="employee-actions"
          panelWidth="300px"
          defaultOffset={{ x: 450, y: 0 }}
        >
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
          />
        </DraggablePanel>
      )}
      {showProcessingIssue && (
        <ProcessingIssueModal
          message={state.session.processingError}
          onRetry={actions.onRingUp}
          onDismiss={actions.onDismissProcessingError}
          canRetry={
            state.tray.length > 0 &&
            !state.session.isProcessing &&
            !state.session.isRungUp
          }
          isRetrying={state.session.isProcessing}
        />
      )}
      {state.minigameResult && (
        <MinigameResultModal
          result={state.minigameResult}
          onDismiss={actions.onDismissMinigameResult}
        />
      )}
    </div>
  );
}

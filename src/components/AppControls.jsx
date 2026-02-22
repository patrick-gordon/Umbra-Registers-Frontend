import { useRegisterStore } from "../context/useRegisterStore";

export default function AppControls() {
  const { state, actions } = useRegisterStore();
  const errorCode =
    typeof state.nuiError === "string"
      ? (state.nuiError.match(/^\[([A-Z_]+)\]/)?.[1] ?? "")
      : "";
  const isReconnectState =
    errorCode === "TIMEOUT" || errorCode === "FETCH_ERROR" || errorCode === "HTTP_ERROR";

  return (
    <div className="app-controls">
      <div className="app-view-tabs">
        {state.allowedViews.includes("employee") && (
          <button
            type="button"
            onClick={() => actions.setView("employee")}
            className={state.view === "employee" ? "is-active btn-primary" : "btn-secondary"}
          >
            Employee
          </button>
        )}
        {state.allowedViews.includes("customer") && (
          <button
            type="button"
            onClick={() => actions.setView("customer")}
            className={state.view === "customer" ? "is-active btn-primary" : "btn-secondary"}
          >
            Customer
          </button>
        )}
        {state.allowedViews.includes("manager") && (
          <button
            type="button"
            onClick={() => actions.setView("manager")}
            className={state.view === "manager" ? "is-active btn-primary" : "btn-secondary"}
          >
            Manager
          </button>
        )}
        <button type="button" className="app-view-close-btn btn-secondary" onClick={actions.closeUi}>
          Close Panel
        </button>
      </div>

      {state.nuiPendingAction && (
        <div className="app-status ds-state--loading" role="status" aria-live="polite">
          Loading: <strong>{state.nuiPendingAction}</strong>
        </div>
      )}

      {state.lastNuiEvent && !state.nuiPendingAction && (
        <div className="app-status">
          Last NUI event: <strong>{state.lastNuiEvent}</strong>
        </div>
      )}

      {state.nuiError && (
        <div
          className={`app-status ${isReconnectState ? "ds-state--reconnect" : "app-status--error ds-state--error"}`}
          role="alert"
        >
          <span>
            {isReconnectState ? "Reconnect required" : "NUI Error"}: <strong>{state.nuiError}</strong>
          </span>
          <button type="button" className="app-status-action" onClick={actions.clearNuiError}>
            Dismiss
          </button>
        </div>
      )}

      {state.interactionContext ? (
        <div className="app-status">
          Interaction: <strong>{state.interactionContext.businessId}</strong> /{" "}
          <strong>{state.interactionContext.interactionId}</strong>
        </div>
      ) : (
        <div className="app-status ds-state--empty">
          Empty: <strong>No active interaction context</strong>
        </div>
      )}
      {state.allowedViews.length <= 1 && (
        <div className="app-status ds-state--disabled">
          Disabled: <strong>Only one role view is available in this context</strong>
        </div>
      )}
    </div>
  );
}

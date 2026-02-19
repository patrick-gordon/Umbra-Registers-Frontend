import AppControls from "./components/AppControls";
import CustomerView from "./components/CustomerView";
import EmployeeView from "./components/EmployeeView";
import ManagerView from "./components/ManagerView";
import { RegisterProvider } from "./context/RegisterContext";
import { useRegisterStore } from "./context/useRegisterStore";
import "./App.css";

function AppShell() {
  const { state } = useRegisterStore();
  const isDetachedView = state.view === "employee" || state.view === "customer";

  if (!state.uiVisible) {
    return null;
  }

  return (
    <div
      className={`app-modal-layer ${isDetachedView ? "app-modal-layer--detached" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Umbra Register"
    >
      <div className={`app-shell ${isDetachedView ? "app-shell--detached" : ""}`}>
        {/* <header className="app-header">
          <h1>Umbra Register</h1>
          <p>Point-of-sale dashboard</p>
        </header> */}

        <section className="app-surface app-surface--controls">
          <AppControls />
        </section>

        <section className="app-surface app-surface--content">
          {state.view === "manager" && state.allowedViews.includes("manager") && <ManagerView />}
          {state.view === "employee" && state.allowedViews.includes("employee") && <EmployeeView />}
          {state.view === "customer" && <CustomerView />}
        </section>

        {state.session.isProcessing && state.activeRegisterTierLevel === 1 && (
          <div className="register-loading-overlay">
            <div className="register-loading-modal">
              <div className="register-loading-spinner" aria-hidden="true" />
              <h3>Calibrating Starter Register</h3>
              <p>Scanning prices and computing total...</p>
              <p>{Math.min(100, Math.max(0, state.session.processingProgress))}%</p>
              <div className="register-loading-bar">
                <div
                  className="register-loading-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, state.session.processingProgress))}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <RegisterProvider>
      <AppShell />
    </RegisterProvider>
  );
}

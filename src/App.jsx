import AppControls from "./components/AppControls";
import CustomerView from "./components/CustomerView";
import EmployeeView from "./components/EmployeeView";
import ManagerView from "./components/ManagerView";
import { RegisterProvider } from "./context/RegisterContext";
import { useRegisterStore } from "./context/useRegisterStore";
import "./App.css";

function AppShell() {
  const { state } = useRegisterStore();
  const showManagerView = state.view === "manager" && state.allowedViews.includes("manager");
  const showEmployeeView = state.view === "employee" && state.allowedViews.includes("employee");
  const showCustomerView = state.view === "customer" && state.allowedViews.includes("customer");
  const isDetachedView = showEmployeeView || showCustomerView;

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
          {state.allowedViews.includes("manager") && (
            <div
              className={`app-role-view app-role-view--manager ${showManagerView ? "is-visible" : "is-hidden"}`}
              aria-hidden={!showManagerView}
            >
              {showManagerView && <ManagerView />}
            </div>
          )}
          <div
            className={`app-role-view app-role-view--employee ${showEmployeeView ? "is-visible" : "is-hidden"}`}
            aria-hidden={!showEmployeeView}
          >
            {showEmployeeView && <EmployeeView />}
          </div>
          <div
            className={`app-role-view app-role-view--customer ${showCustomerView ? "is-visible" : "is-hidden"}`}
            aria-hidden={!showCustomerView}
          >
            {showCustomerView && <CustomerView />}
          </div>
        </section>

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

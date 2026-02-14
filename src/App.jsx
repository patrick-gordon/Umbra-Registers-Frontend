import AppControls from "./components/AppControls";
import CustomerView from "./components/CustomerView";
import EmployeeView from "./components/EmployeeView";
import ManagerView from "./components/ManagerView";
import { RegisterProvider, useRegisterStore } from "./context/RegisterContext";

function AppShell() {
  const { state } = useRegisterStore();

  return (
    <div style={{ padding: 20 }}>
      <h1>Register</h1>
      <AppControls />
      {state.view === "manager" && <ManagerView />}
      {state.view === "employee" && <EmployeeView />}
      {state.view === "customer" && <CustomerView />}
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

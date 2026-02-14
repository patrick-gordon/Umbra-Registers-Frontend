import { useRegisterStore } from "../context/RegisterContext";

export default function AppControls() {
  const { state, actions } = useRegisterStore();

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          Active Store:
          <select
            value={state.activeStoreId}
            onChange={(e) => actions.onStoreChange(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {state.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        <button
          onClick={() => actions.setView("employee")}
          style={{ fontWeight: state.view === "employee" ? "bold" : "normal" }}
        >
          Employee View
        </button>
        <button
          onClick={() => actions.setView("customer")}
          style={{ fontWeight: state.view === "customer" ? "bold" : "normal" }}
        >
          Customer View
        </button>
        <button
          onClick={() => actions.setView("manager")}
          style={{ fontWeight: state.view === "manager" ? "bold" : "normal" }}
        >
          Manager View
        </button>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          Active Register:
          <select
            value={state.activeRegisterId}
            onChange={(e) => actions.onRegisterChange(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {state.registers.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

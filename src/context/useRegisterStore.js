import { useContext } from "react";
import { RegisterContext } from "./registerStoreContext";

export function useRegisterStore() {
  const context = useContext(RegisterContext);
  if (!context) {
    throw new Error("useRegisterStore must be used within RegisterProvider");
  }
  return context;
}

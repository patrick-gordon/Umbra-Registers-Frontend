import { useState } from "react";
import { items } from "./data/items";
import ItemGrid from "./components/ItemGrid";
import Tray from "./components/Tray";

function App() {
  const [tray, setTray] = useState([]);

  const addItem = (item) => {
    const existing = tray.find((t) => t.id === item.id);

    if (existing) {
      setTray(
        tray.map((t) => (t.id === item.id ? { ...t, qty: t.qty + 1 } : t)),
      );
    } else {
      setTray([...tray, { ...item, qty: 1 }]);
    }
  };

  const decreaseItem = (id) => {
    setTray(
      tray
        .map((t) => (t.id === id ? { ...t, qty: t.qty - 1 } : t))
        .filter((t) => t.qty > 0),
    );
  };

  const removeItem = (id) => {
    setTray(tray.filter((t) => t.id !== id));
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 40 }}>
        <ItemGrid items={items} onAdd={addItem} />

        <Tray
          tray={tray}
          onAdd={addItem}
          onDecrease={decreaseItem}
          onRemove={removeItem}
        />
      </div>
    </div>
  );
}

export default App;

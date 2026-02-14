import { useRegisterStore } from "../context/RegisterContext";

function StoresSection({
  storesCount,
  activeStoreId,
  newStoreName,
  onStoreNameChange,
  onAddStore,
  onRemoveStore,
}) {
  return (
    <>
      <h2>Stores</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="New store name"
          value={newStoreName}
          onChange={(e) => onStoreNameChange(e.target.value)}
        />
        <button onClick={onAddStore}>Add Store</button>
        <button onClick={() => onRemoveStore(activeStoreId)} disabled={storesCount <= 1}>
          Remove Active Store
        </button>
      </div>
    </>
  );
}

function RegistersSection({
  registers,
  activeRegisterId,
  newRegisterName,
  onRegisterNameChange,
  onAddRegister,
  onSelectRegister,
  onRemoveRegister,
}) {
  return (
    <>
      <h2>Registers (Active Store Only)</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="New register name"
          value={newRegisterName}
          onChange={(e) => onRegisterNameChange(e.target.value)}
        />
        <button onClick={onAddRegister}>Add Register</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {registers.map((register) => (
          <div
            key={register.id}
            style={{
              border: "1px solid var(--umbra-border)",
              padding: 8,
              borderRadius: 8,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <button onClick={() => onSelectRegister(register.id)}>{register.name}</button>
            <button
              onClick={() => onRemoveRegister(register.id)}
              disabled={registers.length <= 1 || register.id === activeRegisterId && registers.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function MenuItemsSection({
  categories,
  categoryFilter,
  onCategoryFilterChange,
  newItem,
  onNewItemChange,
  onAddMenuItem,
  managerItems,
  onUpdateItem,
  onRemoveMenuItem,
}) {
  return (
    <>
      <h2>Menu Items (Active Store Only)</h2>
      <div style={{ marginBottom: 12 }}>
        <label>
          Category:
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="All Categories">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px, 1fr) 140px 120px 120px 120px 100px",
          gap: 12,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Item name"
          value={newItem.name}
          onChange={(e) => onNewItemChange("name", e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Price"
          value={newItem.price}
          onChange={(e) => onNewItemChange("price", e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Stock"
          value={newItem.stock}
          onChange={(e) => onNewItemChange("stock", e.target.value)}
        />
        <input
          type="number"
          step="1"
          placeholder="Sort order"
          value={newItem.sortOrder}
          onChange={(e) => onNewItemChange("sortOrder", e.target.value)}
        />
        <input
          type="text"
          placeholder="Category"
          value={newItem.category}
          onChange={(e) => onNewItemChange("category", e.target.value)}
        />
        <button onClick={onAddMenuItem}>Add Item</button>
      </div>

      {managerItems.map((item) => (
        <div
          key={item.id}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(140px, 1fr) 140px 120px 120px 120px 100px",
            gap: 12,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdateItem(item.id, "name", e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.price}
            onChange={(e) => onUpdateItem(item.id, "price", e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="1"
            value={item.stock}
            onChange={(e) => onUpdateItem(item.id, "stock", e.target.value)}
          />
          <input
            type="number"
            step="1"
            value={item.sortOrder}
            onChange={(e) => onUpdateItem(item.id, "sortOrder", e.target.value)}
          />
          <input
            type="text"
            value={item.category}
            onChange={(e) => onUpdateItem(item.id, "category", e.target.value)}
          />
          <button onClick={() => onRemoveMenuItem(item.id)}>Delete</button>
        </div>
      ))}
    </>
  );
}

function DiscountsSection({
  newDiscount,
  onNewDiscountChange,
  onToggleNewDiscountItem,
  onAddDiscount,
  sortedCatalog,
  discounts,
  onUpdateDiscount,
  onToggleDiscountItem,
  onRemoveDiscount,
}) {
  return (
    <>
      <h2 style={{ marginTop: 28 }}>Discounts (Active Store Only)</h2>
      <div
        style={{
          border: "1px solid var(--umbra-border)",
          padding: 12,
          marginBottom: 16,
          borderRadius: 8,
        }}
      >
        <h3>Add Discount</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Discount name"
            value={newDiscount.name}
            onChange={(e) => onNewDiscountChange("name", e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Discount price"
            value={newDiscount.discountPrice}
            onChange={(e) => onNewDiscountChange("discountPrice", e.target.value)}
          />
          <input
            type="date"
            value={newDiscount.startDate}
            onChange={(e) => onNewDiscountChange("startDate", e.target.value)}
          />
          <input
            type="date"
            value={newDiscount.endDate}
            onChange={(e) => onNewDiscountChange("endDate", e.target.value)}
          />
          <button onClick={onAddDiscount}>Add Discount</button>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {sortedCatalog.map((item) => (
            <label key={item.id} style={{ display: "flex", gap: 4 }}>
              <input
                type="checkbox"
                checked={newDiscount.itemIds.includes(item.id)}
                onChange={() => onToggleNewDiscountItem(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      </div>

      {discounts.map((discount) => (
        <div
          key={discount.id}
          style={{
            border: "1px solid var(--umbra-border)",
            padding: 12,
            marginBottom: 12,
            borderRadius: 8,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input
              type="text"
              value={discount.name}
              onChange={(e) => onUpdateDiscount(discount.id, "name", e.target.value)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount.discountPrice}
              onChange={(e) =>
                onUpdateDiscount(discount.id, "discountPrice", e.target.value)
              }
            />
            <input
              type="date"
              value={discount.startDate}
              onChange={(e) => onUpdateDiscount(discount.id, "startDate", e.target.value)}
            />
            <input
              type="date"
              value={discount.endDate}
              onChange={(e) => onUpdateDiscount(discount.id, "endDate", e.target.value)}
            />
            <button onClick={() => onRemoveDiscount(discount.id)}>Delete</button>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {sortedCatalog.map((item) => (
              <label key={`${discount.id}-${item.id}`} style={{ display: "flex", gap: 4 }}>
                <input
                  type="checkbox"
                  checked={discount.itemIds.includes(item.id)}
                  onChange={() => onToggleDiscountItem(discount.id, item.id)}
                />
                {item.name}
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default function ManagerView() {
  const { state, actions } = useRegisterStore();
  const s = state;
  const a = actions;

  return (
    <div>
      <StoresSection
        storesCount={s.storesCount}
        activeStoreId={s.activeStoreId}
        newStoreName={s.newStoreName}
        onStoreNameChange={a.onStoreNameChange}
        onAddStore={a.onAddStore}
        onRemoveStore={a.onRemoveStore}
      />
      <RegistersSection
        registers={s.registers}
        activeRegisterId={s.activeRegisterId}
        newRegisterName={s.newRegisterName}
        onRegisterNameChange={a.onRegisterNameChange}
        onAddRegister={a.onAddRegister}
        onSelectRegister={a.onSelectRegister}
        onRemoveRegister={a.onRemoveRegister}
      />
      <MenuItemsSection
        categories={s.categories}
        categoryFilter={s.categoryFilter}
        onCategoryFilterChange={a.onCategoryFilterChange}
        newItem={s.newItem}
        onNewItemChange={a.onNewItemChange}
        onAddMenuItem={a.onAddMenuItem}
        managerItems={s.managerItems}
        onUpdateItem={a.onUpdateItem}
        onRemoveMenuItem={a.onRemoveMenuItem}
      />
      <DiscountsSection
        newDiscount={s.newDiscount}
        onNewDiscountChange={a.onNewDiscountChange}
        onToggleNewDiscountItem={a.onToggleNewDiscountItem}
        onAddDiscount={a.onAddDiscount}
        sortedCatalog={s.sortedCatalog}
        discounts={s.discounts}
        onUpdateDiscount={a.onUpdateDiscount}
        onToggleDiscountItem={a.onToggleDiscountItem}
        onRemoveDiscount={a.onRemoveDiscount}
      />
    </div>
  );
}

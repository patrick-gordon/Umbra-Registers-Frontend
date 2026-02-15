import { useEffect, useMemo, useState } from "react";
import { useRegisterStore } from "../context/RegisterContext";
import "./ManagerView.css";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17.25V21h3.75L18.8 8.94l-3.75-3.75L3 17.25Zm17.71-10.04a1 1 0 0 0 0-1.41L18.2 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v9H7V9Zm4 0h2v9h-2V9Zm4 0h2v9h-2V9ZM6 21h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z" />
    </svg>
  );
}

function IconButton({ label, variant = "neutral", onClick, disabled, children }) {
  return (
    <button
      className={`mgr-icon-btn mgr-icon-btn--${variant}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, subtitle, children, collapsible = false, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section
      className={`mgr-card ${collapsible ? "is-collapsible" : ""} ${isOpen ? "is-open" : "is-closed"}`}
    >
      <div className="mgr-card-headline">
        <div className="mgr-card-header">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {collapsible && (
          <button
            type="button"
            className="mgr-collapse-btn"
            onClick={() => setIsOpen((current) => !current)}
          >
            {isOpen ? "Close" : "Open"}
          </button>
        )}
      </div>
      {(!collapsible || isOpen) && <div className="mgr-card-content">{children}</div>}
    </section>
  );
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value) {
  return moneyFormatter.format(value || 0);
}

function formatPct(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}

function toneClass(value, polarity = "good-high") {
  if (value === 0) return "";
  if (polarity === "good-high") return value > 0 ? "metric-good" : "metric-bad";
  return value > 0 ? "metric-bad" : "metric-good";
}

function RegisterStatsSection({
  activeRegisterId,
  registers,
  managerRegisterStats,
  registerTierCatalog,
  onUpgradeRegisterTier,
}) {
  const [selectedRegisterId, setSelectedRegisterId] = useState("all");

  useEffect(() => {
    const validIds = new Set(registers.map((register) => register.id));
    if (selectedRegisterId !== "all" && !validIds.has(selectedRegisterId)) {
      setSelectedRegisterId("all");
    }
  }, [registers, selectedRegisterId]);

  useEffect(() => {
    if (!activeRegisterId) return;
    if (selectedRegisterId !== "all") return;
    setSelectedRegisterId("all");
  }, [activeRegisterId, selectedRegisterId]);

  const scopedRows = useMemo(
    () =>
      selectedRegisterId === "all"
        ? managerRegisterStats
        : managerRegisterStats.filter((row) => row.registerId === selectedRegisterId),
    [managerRegisterStats, selectedRegisterId],
  );

  const aggregate = useMemo(
    () =>
      scopedRows.reduce(
        (acc, row) => {
          acc.totalSales += row.totalSales ?? 0;
          acc.totalTransactions += row.totalTransactions ?? 0;
          acc.paidTransactions += row.paidTransactions ?? 0;
          acc.stolenTransactions += row.stolenTransactions ?? 0;
          acc.stealAttempts += row.stealAttempts ?? 0;
          acc.blockedStealAttempts += row.blockedStealAttempts ?? 0;
          acc.itemsSold += row.itemsSold ?? 0;
          acc.itemsStolen += row.itemsStolen ?? 0;
          return acc;
        },
        {
          totalSales: 0,
          totalTransactions: 0,
          paidTransactions: 0,
          stolenTransactions: 0,
          stealAttempts: 0,
          blockedStealAttempts: 0,
          itemsSold: 0,
          itemsStolen: 0,
        },
      ),
    [scopedRows],
  );

  const theftRate =
    aggregate.totalTransactions > 0
      ? aggregate.stolenTransactions / aggregate.totalTransactions
      : 0;
  const avgTicket =
    aggregate.paidTransactions > 0 ? aggregate.totalSales / aggregate.paidTransactions : 0;
  const selectedRegisterForTier =
    selectedRegisterId === "all" ? activeRegisterId : selectedRegisterId;
  const selectedRow =
    managerRegisterStats.find((row) => row.registerId === selectedRegisterForTier) ??
    managerRegisterStats[0];
  const selectedTier = selectedRow
    ? registerTierCatalog.find((tier) => tier.level === selectedRow.tierLevel) ??
      registerTierCatalog[0]
    : registerTierCatalog[0];
  const hasNextTier = selectedTier && selectedTier.level < registerTierCatalog.length;

  return (
    <SectionCard
      title="Register Performance"
      subtitle="Track sales, theft activity, and transaction health by register."
      collapsible
      defaultOpen
    >
      <div className="mgr-filter-row">
        <label htmlFor="register-stats-filter">Stats Scope</label>
        <select
          id="register-stats-filter"
          value={selectedRegisterId}
          onChange={(e) => setSelectedRegisterId(e.target.value)}
        >
          <option value="all">All Registers (Active Store)</option>
          {registers.map((register) => (
            <option key={register.id} value={register.id}>
              {register.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mgr-stat-grid">
        <div className="mgr-stat-card">
          <span>Total Sales</span>
          <strong className={toneClass(aggregate.totalSales, "good-high")}>
            {formatMoney(aggregate.totalSales)}
          </strong>
        </div>
        <div className="mgr-stat-card">
          <span>Paid Transactions</span>
          <strong className={toneClass(aggregate.paidTransactions, "good-high")}>
            {aggregate.paidTransactions}
          </strong>
        </div>
        <div className="mgr-stat-card">
          <span>Stolen Transactions</span>
          <strong className={toneClass(aggregate.stolenTransactions, "good-low")}>
            {aggregate.stolenTransactions}
          </strong>
        </div>
        <div className="mgr-stat-card">
          <span>Steal Attempts</span>
          <strong className={toneClass(aggregate.stealAttempts, "good-low")}>
            {aggregate.stealAttempts}
          </strong>
        </div>
        <div className="mgr-stat-card">
          <span>Blocked Attempts</span>
          <strong className={toneClass(aggregate.blockedStealAttempts, "good-high")}>
            {aggregate.blockedStealAttempts}
          </strong>
        </div>
        <div className="mgr-stat-card">
          <span>Theft Rate</span>
          <strong className={toneClass(theftRate, "good-low")}>{formatPct(theftRate)}</strong>
        </div>
        <div className="mgr-stat-card">
          <span>Average Ticket</span>
          <strong className={toneClass(avgTicket, "good-high")}>{formatMoney(avgTicket)}</strong>
        </div>
      </div>

      {selectedRow && selectedTier && (
        <div className="mgr-tier-panel">
          <div className="mgr-tier-head">
            <div>
              <p className="mgr-tier-kicker">Register Tier</p>
              <h3>
                L{selectedTier.level} - {selectedTier.name}
              </h3>
              <p className="mgr-tier-meta">
                {selectedRow.registerName} | Processing {selectedTier.processingMs}ms
              </p>
            </div>
            <button
              type="button"
              className="mgr-action-btn"
              disabled={!hasNextTier}
              onClick={() => onUpgradeRegisterTier(selectedRow.registerId)}
            >
              {hasNextTier
                ? `Upgrade to L${selectedTier.level + 1}`
                : "Max Tier Reached"}
            </button>
          </div>
          <div className="mgr-tier-unlocks">
            {selectedTier.unlocks.map((unlock) => (
              <span key={unlock}>{unlock}</span>
            ))}
          </div>
        </div>
      )}

    </SectionCard>
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
  const [editingItemId, setEditingItemId] = useState(null);

  return (
    <SectionCard
      title="Menu Items"
      subtitle="Filter by category, add new items, and edit item details inline."
      collapsible
      defaultOpen={false}
    >
      <div className="mgr-filter-row">
        <label htmlFor="manager-category-filter">Category</label>
        <select
          id="manager-category-filter"
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
        >
          <option value="All Categories">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="mgr-table mgr-table--form mgr-table--menu-form">
        <input
          type="text"
          placeholder="Name"
          value={newItem.name}
          onChange={(e) => onNewItemChange("name", e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="$"
          value={newItem.price}
          onChange={(e) => onNewItemChange("price", e.target.value)}
        />
        <input
          type="number"
          step="1"
          placeholder="Sort"
          value={newItem.sortOrder}
          onChange={(e) => onNewItemChange("sortOrder", e.target.value)}
        />
        <input
          type="text"
          placeholder="Category"
          value={newItem.category}
          onChange={(e) => onNewItemChange("category", e.target.value)}
        />
        <button
          type="button"
          className="mgr-action-btn mgr-table-form-action"
          onClick={onAddMenuItem}
        >
          <PlusIcon />
          Add Item
        </button>
      </div>

      <div className="mgr-table-header mgr-table-header--menu">
        <span>Name</span>
        <span>Price</span>
        <span>Sort</span>
        <span>Category</span>
        <span>Actions</span>
      </div>

      {managerItems.map((item) => {
        const isEditing = editingItemId === item.id;
        return (
          <div
            key={item.id}
            className={`mgr-table mgr-table--menu ${isEditing ? "is-editing" : "is-compact"}`}
          >
            {isEditing ? (
              <input
                type="text"
                value={item.name}
                onChange={(e) => onUpdateItem(item.id, "name", e.target.value)}
              />
            ) : (
              <span className="mgr-cell-text" title={item.name}>
                {item.name}
              </span>
            )}
            {isEditing ? (
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => onUpdateItem(item.id, "price", e.target.value)}
              />
            ) : (
              <span className="mgr-cell-text">${Number(item.price).toFixed(2)}</span>
            )}
            {isEditing ? (
              <input
                type="number"
                step="1"
                value={item.sortOrder}
                onChange={(e) => onUpdateItem(item.id, "sortOrder", e.target.value)}
              />
            ) : (
              <span className="mgr-cell-text">{item.sortOrder}</span>
            )}
            {isEditing ? (
              <input
                type="text"
                value={item.category}
                onChange={(e) => onUpdateItem(item.id, "category", e.target.value)}
              />
            ) : (
              <span className="mgr-cell-text" title={item.category}>
                {item.category}
              </span>
            )}
            <div className="mgr-actions mgr-actions--menu">
              <IconButton
                label={isEditing ? "Close Edit" : "Enable Edit"}
                variant={isEditing ? "active" : "neutral"}
                onClick={() => setEditingItemId(isEditing ? null : item.id)}
              >
                <PencilIcon />
              </IconButton>
              <IconButton
                label={`Delete ${item.name}`}
                variant="danger"
                onClick={() => onRemoveMenuItem(item.id)}
              >
                <TrashIcon />
              </IconButton>
            </div>
          </div>
        );
      })}
    </SectionCard>
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
  const [editingDiscountId, setEditingDiscountId] = useState(null);

  return (
    <SectionCard
      title="Discounts"
      subtitle="Create promo windows and apply discounts to selected menu items."
      collapsible
      defaultOpen={false}
    >
      <div className="mgr-sub-card">
        <h3>Add Discount</h3>
        <div className="mgr-form-row">
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
          <button type="button" className="mgr-action-btn" onClick={onAddDiscount}>
            <PlusIcon />
            Add Discount
          </button>
        </div>
        <div className="mgr-checkbox-grid">
          {sortedCatalog.map((item) => (
            <label key={item.id}>
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

      {discounts.map((discount) => {
        const isEditing = editingDiscountId === discount.id;
        return (
          <div
            key={discount.id}
            className={`mgr-sub-card mgr-sub-card--discount ${isEditing ? "is-editing" : ""}`}
          >
            <div className="mgr-form-row">
              <input
                type="text"
                value={discount.name}
                disabled={!isEditing}
                onChange={(e) => onUpdateDiscount(discount.id, "name", e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount.discountPrice}
                disabled={!isEditing}
                onChange={(e) =>
                  onUpdateDiscount(discount.id, "discountPrice", e.target.value)
                }
              />
              <input
                type="date"
                value={discount.startDate}
                disabled={!isEditing}
                onChange={(e) => onUpdateDiscount(discount.id, "startDate", e.target.value)}
              />
              <input
                type="date"
                value={discount.endDate}
                disabled={!isEditing}
                onChange={(e) => onUpdateDiscount(discount.id, "endDate", e.target.value)}
              />
              <div className="mgr-actions">
                <IconButton
                  label={isEditing ? "Stop editing discount" : "Edit discount"}
                  variant={isEditing ? "active" : "neutral"}
                  onClick={() => setEditingDiscountId(isEditing ? null : discount.id)}
                >
                  <PencilIcon />
                </IconButton>
                <IconButton
                  label={`Delete ${discount.name}`}
                  variant="danger"
                  onClick={() => onRemoveDiscount(discount.id)}
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </div>

            <div className="mgr-checkbox-grid">
              {sortedCatalog.map((item) => (
                <label key={`${discount.id}-${item.id}`}>
                  <input
                    type="checkbox"
                    checked={discount.itemIds.includes(item.id)}
                    disabled={!isEditing}
                    onChange={() => onToggleDiscountItem(discount.id, item.id)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

function InteractionPrototypeSection({ businessInteractions, onOpenInteractionAsRole }) {
  return (
    <SectionCard
      title="Business Interaction Prototype"
      subtitle="Simulate role entry points from polyzones and props."
      collapsible
      defaultOpen={false}
    >
      {businessInteractions.map((business) => (
        <div key={business.businessId} className="mgr-sub-card">
          <h3>{business.label}</h3>
          {business.interactionPoints.map((point) => (
            <div key={point.id} className="mgr-interaction-row">
              <div>
                <strong>{point.label}</strong> ({point.type})
              </div>
              <div>Register: {point.registerId}</div>
              <div className="mgr-actions">
                <button
                  type="button"
                  className="mgr-ghost-btn"
                  onClick={() =>
                    onOpenInteractionAsRole({
                      role: "manager",
                      businessId: business.businessId,
                      interactionId: point.id,
                      registerId: point.registerId,
                    })
                  }
                >
                  Manager
                </button>
                <button
                  type="button"
                  className="mgr-ghost-btn"
                  onClick={() =>
                    onOpenInteractionAsRole({
                      role: "employee",
                      businessId: business.businessId,
                      interactionId: point.id,
                      registerId: point.registerId,
                    })
                  }
                >
                  Employee
                </button>
                <button
                  type="button"
                  className="mgr-ghost-btn"
                  onClick={() =>
                    onOpenInteractionAsRole({
                      role: "customer",
                      businessId: business.businessId,
                      interactionId: point.id,
                      registerId: point.registerId,
                    })
                  }
                >
                  Customer
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </SectionCard>
  );
}

export default function ManagerView() {
  const { state, actions } = useRegisterStore();
  const s = state;
  const a = actions;

  return (
    <div className="mgr-shell view-shell">
      <RegisterStatsSection
        activeRegisterId={s.activeRegisterId}
        registers={s.registers}
        managerRegisterStats={s.managerRegisterStats}
        registerTierCatalog={s.registerTierCatalog}
        onUpgradeRegisterTier={a.onUpgradeRegisterTier}
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
      <InteractionPrototypeSection
        businessInteractions={s.businessInteractions}
        onOpenInteractionAsRole={a.openInteractionAsRole}
      />
    </div>
  );
}

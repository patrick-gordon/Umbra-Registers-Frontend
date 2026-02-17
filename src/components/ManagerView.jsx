import { useMemo, useState } from "react";
import { useRegisterStore } from "../context/useRegisterStore";
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

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const WEEKDAY_SET = Object.freeze([1, 2, 3, 4, 5]);
const WEEKEND_SET = Object.freeze([0, 6]);

function normalizeWeekdayList(days) {
  return [...new Set((Array.isArray(days) ? days : []).map(Number))]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function areWeekdayListsEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function resolveWeekdayPreset(days) {
  const normalized = normalizeWeekdayList(days);
  if (normalized.length === 0) return "everyday";
  if (areWeekdayListsEqual(normalized, WEEKDAY_SET)) return "weekdays";
  if (areWeekdayListsEqual(normalized, WEEKEND_SET)) return "weekends";
  return "custom";
}

function weekdaysFromPreset(preset) {
  if (preset === "weekdays") return [...WEEKDAY_SET];
  if (preset === "weekends") return [...WEEKEND_SET];
  if (preset === "everyday") return [];
  return null;
}

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
  const validRegisterIds = useMemo(
    () => new Set(registers.map((register) => register.id)),
    [registers],
  );
  const effectiveSelectedRegisterId =
    selectedRegisterId === "all" || validRegisterIds.has(selectedRegisterId)
      ? selectedRegisterId
      : "all";

  const scopedRows = useMemo(
    () =>
      effectiveSelectedRegisterId === "all"
        ? managerRegisterStats
        : managerRegisterStats.filter(
            (row) => row.registerId === effectiveSelectedRegisterId,
          ),
    [effectiveSelectedRegisterId, managerRegisterStats],
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
    effectiveSelectedRegisterId === "all"
      ? activeRegisterId ?? registers[0]?.id
      : effectiveSelectedRegisterId;
  const selectedRow =
    managerRegisterStats.find((row) => row.registerId === selectedRegisterForTier) ??
    managerRegisterStats[0];
  const selectedTier = selectedRow
    ? registerTierCatalog.find((tier) => tier.level === selectedRow.tierLevel) ??
      registerTierCatalog[0]
    : registerTierCatalog[0];
  const hasNextTier = selectedTier && selectedTier.level < registerTierCatalog.length;
  const suspiciousRows = useMemo(
    () =>
      scopedRows.filter(
        (row) => Array.isArray(row.suspiciousFlags) && row.suspiciousFlags.length > 0,
      ),
    [scopedRows],
  );

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
          value={effectiveSelectedRegisterId}
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

      <div className="mgr-alert-panel">
        <p className="mgr-tier-kicker">Suspicious Activity Flags</p>
        {suspiciousRows.length === 0 ? (
          <p className="mgr-alert-empty">No active suspicious activity flags.</p>
        ) : (
          <div className="mgr-alert-list">
            {suspiciousRows.map((row) => (
              <div key={`alerts-${row.registerId}`} className="mgr-alert-row">
                <strong>{row.registerName}</strong>
                <div className="mgr-alert-chip-row">
                  {row.suspiciousFlags.map((flag) => (
                    <span
                      key={`${row.registerId}-${flag.code}`}
                      className={`mgr-alert-chip mgr-alert-chip--${flag.severity}`}
                    >
                      {flag.label} ({flag.count})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
  onToggleNewDiscountWeekday,
  onAddDiscount,
  sortedCatalog,
  discounts,
  onUpdateDiscount,
  onToggleDiscountWeekday,
  onToggleDiscountItem,
  onRemoveDiscount,
}) {
  const [editingDiscountId, setEditingDiscountId] = useState(null);
  const [isNewDiscountCustomWeekdays, setIsNewDiscountCustomWeekdays] = useState(false);
  const [customWeekdayModeByDiscountId, setCustomWeekdayModeByDiscountId] = useState({});
  const newDiscountType = newDiscount.discountType === "fixed" ? "fixed" : "percentage";
  const newDiscountAppliesToAll = Boolean(newDiscount.applyToAllItems);
  const newDiscountIsForever = Boolean(newDiscount.isForever);
  const newDiscountWeekdayPreset = isNewDiscountCustomWeekdays
    ? "custom"
    : resolveWeekdayPreset(newDiscount.weekdays);
  const newDiscountValue =
    newDiscount.discountValue ?? newDiscount.discountPrice ?? "";
  const resolveDiscountType = (discount) =>
    discount.discountType === "fixed" || discount.discountType === "percentage"
      ? discount.discountType
      : Number.isFinite(Number(discount.discountPercent))
        ? "percentage"
        : "fixed";
  const resolveDiscountValue = (discount) =>
    discount.discountValue ??
    (resolveDiscountType(discount) === "percentage"
      ? discount.discountPercent
      : discount.discountPrice) ??
    "";
  const onNewDiscountPresetChange = (value) => {
    if (value === "custom") {
      setIsNewDiscountCustomWeekdays(true);
      return;
    }
    const presetWeekdays = weekdaysFromPreset(value);
    if (!presetWeekdays) return;
    setIsNewDiscountCustomWeekdays(false);
    onNewDiscountChange("weekdays", presetWeekdays);
  };
  const onAddDiscountClick = () => {
    onAddDiscount();
    setIsNewDiscountCustomWeekdays(false);
  };

  return (
    <SectionCard
      title="Discounts"
      subtitle="Create scheduled promotions with percent-off or fixed-price rules."
      collapsible
      defaultOpen={false}
    >
      <div className="mgr-sub-card">
        <h3>Add Promotion</h3>
        <div className="mgr-discount-requirements" role="note" aria-live="polite">
          <p>
            <strong>Required:</strong> Promotion name, discount type/value, and scope
            (enable <em>Apply to all menu items</em> or select at least one item).
          </p>
          <p>
            <strong>Conditional:</strong> Weekdays are required for <em>Weekday Deal</em>,
            event tag is required for <em>Event Special</em>, and start/end time must be
            provided together.
          </p>
          <p>
            <strong>Optional:</strong> Date range (when Forever is off), day schedule preset,
            and event tag for non-event promotions.
          </p>
        </div>
        <div className="mgr-form-row">
          <input
            type="text"
            placeholder="Promotion name (Required)"
            value={newDiscount.name}
            onChange={(e) => onNewDiscountChange("name", e.target.value)}
          />
          <select
            value={newDiscountType}
            onChange={(e) => onNewDiscountChange("discountType", e.target.value)}
          >
            <option value="percentage">Percent Off</option>
            <option value="fixed">Fixed Price</option>
          </select>
          <input
            type="number"
            min={newDiscountType === "percentage" ? "1" : "0"}
            max={newDiscountType === "percentage" ? "100" : undefined}
            step="0.01"
            placeholder={
              newDiscountType === "percentage"
                ? "Percent off (Required)"
                : "Discount price (Required)"
            }
            value={newDiscountValue}
            onChange={(e) => onNewDiscountChange("discountValue", e.target.value)}
          />
          <select
            value={newDiscount.promotionType}
            onChange={(e) => onNewDiscountChange("promotionType", e.target.value)}
          >
            <option value="standard">Standard</option>
            <option value="happyHour">Happy Hour</option>
            <option value="weekdayDeal">Weekday Deal</option>
            <option value="eventSpecial">Event Special</option>
          </select>
          <input
            type="date"
            value={newDiscount.startDate}
            disabled={newDiscountIsForever}
            title="Optional start date"
            onChange={(e) => onNewDiscountChange("startDate", e.target.value)}
          />
          <input
            type="date"
            value={newDiscount.endDate}
            disabled={newDiscountIsForever}
            title="Optional end date"
            onChange={(e) => onNewDiscountChange("endDate", e.target.value)}
          />
          <input
            type="time"
            value={newDiscount.startTime}
            title="Optional start time (requires end time)"
            onChange={(e) => onNewDiscountChange("startTime", e.target.value)}
          />
          <input
            type="time"
            value={newDiscount.endTime}
            title="Optional end time (requires start time)"
            onChange={(e) => onNewDiscountChange("endTime", e.target.value)}
          />
          <input
            type="text"
            placeholder="Event tag (Optional, required for Event Special)"
            value={newDiscount.eventTag}
            onChange={(e) => onNewDiscountChange("eventTag", e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={newDiscountAppliesToAll}
              onChange={(e) =>
                onNewDiscountChange("applyToAllItems", e.target.checked)
              }
            />
            Apply to all menu items (Required scope)
          </label>
          <label>
            <input
              type="checkbox"
              checked={newDiscountIsForever}
              onChange={(e) =>
                onNewDiscountChange("isForever", e.target.checked)
              }
            />
            Forever (Optional)
          </label>
          <div className="mgr-discount-days">
            <label htmlFor="new-discount-days">Day Schedule</label>
            <select
              id="new-discount-days"
              value={newDiscountWeekdayPreset}
              onChange={(e) => onNewDiscountPresetChange(e.target.value)}
            >
              <option value="everyday">Every Day</option>
              <option value="weekdays">All Weekdays (Mon-Fri)</option>
              <option value="weekends">Weekends (Sat-Sun)</option>
              <option value="custom">Custom Days</option>
            </select>
          </div>
          <button type="button" className="mgr-action-btn" onClick={onAddDiscountClick}>
            <PlusIcon />
            Add Promotion
          </button>
        </div>
        <p className="mgr-discount-selection-note">
          Item selection is required only when <em>Apply to all menu items</em> is off.
        </p>
        {newDiscountWeekdayPreset === "custom" && (
          <div className="mgr-checkbox-grid mgr-checkbox-grid--days">
            {WEEKDAY_OPTIONS.map((day) => (
              <label key={`new-discount-day-${day.value}`}>
                <input
                  type="checkbox"
                  checked={newDiscount.weekdays.includes(day.value)}
                  onChange={() => onToggleNewDiscountWeekday(day.value)}
                />
                {day.label}
              </label>
            ))}
          </div>
        )}
        <div className="mgr-checkbox-grid">
          {sortedCatalog.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={newDiscount.itemIds.includes(item.id)}
                disabled={newDiscountAppliesToAll}
                onChange={() => onToggleNewDiscountItem(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      </div>

      {discounts.map((discount) => {
        const isEditing = editingDiscountId === discount.id;
        const discountType = resolveDiscountType(discount);
        const discountValue = resolveDiscountValue(discount);
        const appliesToAll = Boolean(discount.applyToAllItems);
        const isForever =
          discount.isForever === undefined
            ? !discount.startDate && !discount.endDate
            : Boolean(discount.isForever);
        const weekdayPreset = customWeekdayModeByDiscountId[discount.id]
          ? "custom"
          : resolveWeekdayPreset(discount.weekdays);
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
                min={discountType === "percentage" ? "1" : "0"}
                max={discountType === "percentage" ? "100" : undefined}
                step="0.01"
                value={discountValue}
                disabled={!isEditing}
                onChange={(e) =>
                  onUpdateDiscount(discount.id, "discountValue", e.target.value)
                }
              />
              <select
                value={discountType}
                disabled={!isEditing}
                onChange={(e) =>
                  onUpdateDiscount(discount.id, "discountType", e.target.value)
                }
              >
                <option value="percentage">Percent Off</option>
                <option value="fixed">Fixed Price</option>
              </select>
              <select
                value={discount.promotionType ?? "standard"}
                disabled={!isEditing}
                onChange={(e) =>
                  onUpdateDiscount(discount.id, "promotionType", e.target.value)
                }
              >
                <option value="standard">Standard</option>
                <option value="happyHour">Happy Hour</option>
                <option value="weekdayDeal">Weekday Deal</option>
                <option value="eventSpecial">Event Special</option>
              </select>
              <input
                type="date"
                value={discount.startDate ?? ""}
                disabled={!isEditing || isForever}
                onChange={(e) => onUpdateDiscount(discount.id, "startDate", e.target.value)}
              />
              <input
                type="date"
                value={discount.endDate ?? ""}
                disabled={!isEditing || isForever}
                onChange={(e) => onUpdateDiscount(discount.id, "endDate", e.target.value)}
              />
              <input
                type="time"
                value={discount.startTime ?? ""}
                disabled={!isEditing}
                onChange={(e) => onUpdateDiscount(discount.id, "startTime", e.target.value)}
              />
              <input
                type="time"
                value={discount.endTime ?? ""}
                disabled={!isEditing}
                onChange={(e) => onUpdateDiscount(discount.id, "endTime", e.target.value)}
              />
              <input
                type="text"
                placeholder="Event tag"
                value={discount.eventTag ?? ""}
                disabled={!isEditing}
                onChange={(e) => onUpdateDiscount(discount.id, "eventTag", e.target.value)}
              />
              <label>
                <input
                  type="checkbox"
                  checked={appliesToAll}
                  disabled={!isEditing}
                  onChange={(e) =>
                    onUpdateDiscount(discount.id, "applyToAllItems", e.target.checked)
                  }
                />
                Apply to all menu items
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isForever}
                  disabled={!isEditing}
                  onChange={(e) =>
                    onUpdateDiscount(discount.id, "isForever", e.target.checked)
                  }
                />
                Forever (no date range)
              </label>
              <div className="mgr-discount-days">
                <label htmlFor={`${discount.id}-days`}>Day Schedule</label>
                <select
                  id={`${discount.id}-days`}
                  value={weekdayPreset}
                  disabled={!isEditing}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setCustomWeekdayModeByDiscountId((current) => ({
                        ...current,
                        [discount.id]: true,
                      }));
                      return;
                    }
                    const presetWeekdays = weekdaysFromPreset(e.target.value);
                    if (!presetWeekdays) return;
                    setCustomWeekdayModeByDiscountId((current) => ({
                      ...current,
                      [discount.id]: false,
                    }));
                    onUpdateDiscount(discount.id, "weekdays", presetWeekdays);
                  }}
                >
                  <option value="everyday">Every Day</option>
                  <option value="weekdays">All Weekdays (Mon-Fri)</option>
                  <option value="weekends">Weekends (Sat-Sun)</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>
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

            {isEditing && weekdayPreset === "custom" && (
              <div className="mgr-checkbox-grid mgr-checkbox-grid--days">
                {WEEKDAY_OPTIONS.map((day) => (
                  <label key={`${discount.id}-day-${day.value}`}>
                    <input
                      type="checkbox"
                      checked={(discount.weekdays ?? []).includes(day.value)}
                      onChange={() => onToggleDiscountWeekday(discount.id, day.value)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            )}

            <div className="mgr-checkbox-grid">
              {sortedCatalog.map((item) => (
                <label key={`${discount.id}-${item.id}`}>
                  <input
                    type="checkbox"
                    checked={discount.itemIds.includes(item.id)}
                    disabled={!isEditing || appliesToAll}
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

function CombosSection({
  newCombo,
  onNewComboChange,
  onToggleNewComboItem,
  onAddCombo,
  sortedCatalog,
  combos,
  onUpdateCombo,
  onToggleComboItem,
  onRemoveCombo,
}) {
  const [editingComboId, setEditingComboId] = useState(null);

  return (
    <SectionCard
      title="Meal Combos"
      subtitle="Create bundled meals with fixed combo pricing."
      collapsible
      defaultOpen={false}
    >
      <div className="mgr-sub-card">
        <h3>Add Combo</h3>
        <div className="mgr-form-row">
          <input
            type="text"
            placeholder="Combo name"
            value={newCombo.name}
            onChange={(e) => onNewComboChange("name", e.target.value)}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Bundle price"
            value={newCombo.bundlePrice}
            onChange={(e) => onNewComboChange("bundlePrice", e.target.value)}
          />
          <button type="button" className="mgr-action-btn" onClick={onAddCombo}>
            <PlusIcon />
            Add Combo
          </button>
        </div>
        <div className="mgr-checkbox-grid">
          {sortedCatalog.map((item) => (
            <label key={`new-combo-${item.id}`}>
              <input
                type="checkbox"
                checked={newCombo.itemIds.includes(item.id)}
                onChange={() => onToggleNewComboItem(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      </div>

      {combos.map((combo) => {
        const isEditing = editingComboId === combo.id;
        return (
          <div
            key={combo.id}
            className={`mgr-sub-card mgr-sub-card--discount ${isEditing ? "is-editing" : ""}`}
          >
            <div className="mgr-form-row">
              <input
                type="text"
                value={combo.name}
                disabled={!isEditing}
                onChange={(e) => onUpdateCombo(combo.id, "name", e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={combo.bundlePrice}
                disabled={!isEditing}
                onChange={(e) => onUpdateCombo(combo.id, "bundlePrice", e.target.value)}
              />
              <div className="mgr-actions">
                <IconButton
                  label={isEditing ? "Stop editing combo" : "Edit combo"}
                  variant={isEditing ? "active" : "neutral"}
                  onClick={() => setEditingComboId(isEditing ? null : combo.id)}
                >
                  <PencilIcon />
                </IconButton>
                <IconButton
                  label={`Delete ${combo.name}`}
                  variant="danger"
                  onClick={() => onRemoveCombo(combo.id)}
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </div>
            <div className="mgr-checkbox-grid">
              {sortedCatalog.map((item) => (
                <label key={`${combo.id}-${item.id}`}>
                  <input
                    type="checkbox"
                    checked={combo.itemIds.includes(item.id)}
                    disabled={!isEditing}
                    onChange={() => onToggleComboItem(combo.id, item.id)}
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
        onToggleNewDiscountWeekday={a.onToggleNewDiscountWeekday}
        onAddDiscount={a.onAddDiscount}
        sortedCatalog={s.sortedCatalog}
        discounts={s.discounts}
        onUpdateDiscount={a.onUpdateDiscount}
        onToggleDiscountWeekday={a.onToggleDiscountWeekday}
        onToggleDiscountItem={a.onToggleDiscountItem}
        onRemoveDiscount={a.onRemoveDiscount}
      />
      <CombosSection
        newCombo={s.newCombo}
        onNewComboChange={a.onNewComboChange}
        onToggleNewComboItem={a.onToggleNewComboItem}
        onAddCombo={a.onAddCombo}
        sortedCatalog={s.sortedCatalog}
        combos={s.combos}
        onUpdateCombo={a.onUpdateCombo}
        onToggleComboItem={a.onToggleComboItem}
        onRemoveCombo={a.onRemoveCombo}
      />
      <InteractionPrototypeSection
        businessInteractions={s.businessInteractions}
        onOpenInteractionAsRole={a.openInteractionAsRole}
      />
    </div>
  );
}

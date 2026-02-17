import { useEffect } from "react";

export default function MinigameResultModal({ result, onDismiss }) {
  const winner = result?.winner === "customer" ? "customer" : "employee";
  const isEmployeeWinner = winner === "employee";
  const customerScore = Number(result?.customerScore ?? 0);
  const employeeScore = Number(result?.employeeScore ?? 0);
  const title = isEmployeeWinner ? "Employee Won The Minigame" : "Customer Won The Minigame";
  const subtitle =
    winner === "customer"
      ? "The customer overpowered the defense."
      : "The employee successfully defended the register.";
  const winnerLabel = isEmployeeWinner ? "Employee" : "Customer";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  const onBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;
    onDismiss();
  };

  return (
    <div
      className="minigame-result-overlay"
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        className={`minigame-result-modal minigame-result-modal--${winner}`}
        role="alertdialog"
        aria-live="assertive"
        aria-label={title}
      >
        <div className="minigame-result-modal-head">
          <h3 className="card-title">Food War Result</h3>
          <span className={`section-tag ${isEmployeeWinner ? "is-good" : "is-danger"}`}>
            {winnerLabel} Victory
          </span>
        </div>
        <h4 className="minigame-result-title">{title}</h4>
        <p className="view-note minigame-result-subtitle">{subtitle}</p>
        <div className="minigame-result-winner-row">
          <span className="minigame-result-winner-label">Winner</span>
          <strong className="minigame-result-winner-value">{winnerLabel}</strong>
        </div>
        <div className="minigame-result-score">
          <div>
            <span>Employee</span>
            <strong>{employeeScore}</strong>
          </div>
          <div>
            <span>Customer</span>
            <strong>{customerScore}</strong>
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="minigame-result-dismiss">
          Continue
        </button>
      </div>
    </div>
  );
}

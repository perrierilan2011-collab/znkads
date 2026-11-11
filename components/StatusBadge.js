const MAP = {
  pending: { label: "En attente", cls: "badge-warning" },
  awaiting_confirmation: { label: "Attente régie", cls: "badge-info" },
  validated: { label: "Validée", cls: "badge-success" },
  rejected: { label: "Refusée", cls: "badge-danger" },
  expired: { label: "Expirée", cls: "badge-neutral" },
  approved: { label: "Approuvée", cls: "badge-info" },
  paid: { label: "Payée", cls: "badge-success" },
};

export function statusInfo(status) {
  return MAP[status] || { label: status || "—", cls: "badge-neutral" };
}

export default function StatusBadge({ status }) {
  const info = statusInfo(status);
  return (
    <span className={`badge ${info.cls}`}>
      <span className="dot" />
      {info.label}
    </span>
  );
}

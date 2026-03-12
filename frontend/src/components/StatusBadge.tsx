"use client";

const config: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  verified: {
    label: "Verified",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  awaiting_verification: {
    label: "Under Review",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  awaiting_org: {
    label: "Not on Stamp",
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
    icon: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
  },
  correction_proposed: {
    label: "Review Changes",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    icon: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z",
  },
  disputed: {
    label: "Flagged",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
  },
  expired: {
    label: "Follow Up",
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-500",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status] || config.awaiting_org;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text}`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
      </svg>
      {c.label}
    </span>
  );
}

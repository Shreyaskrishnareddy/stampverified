"use client";

const config: Record<string, { label: string; bg: string; text: string; icon: string; help?: string; filled?: boolean }> = {
  verified: {
    label: "Verified",
    bg: "bg-blue-600 border-blue-600",
    text: "text-white",
    icon: "M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z",
    help: "Verified by the organization",
    filled: true,
  },
  awaiting_verification: {
    label: "Sent to Verifier",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
    help: "Verification email sent — waiting for the organization to respond",
  },
  awaiting_org: {
    label: "Company Not on Stamp",
    bg: "bg-gray-50 border-gray-200",
    text: "text-gray-600",
    icon: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
    help: "This organization hasn't registered yet — invite them to get verified",
  },
  correction_proposed: {
    label: "Review Changes",
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    icon: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z",
    help: "The organization suggested corrections — accept or deny them below",
  },
  disputed: {
    label: "Disputed",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    icon: "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
    help: "The organization flagged this claim — edit and resubmit to try again",
  },
  expired: {
    label: "Expired",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
    help: "No response after 30 days — resend the verification request",
  },
  permanently_locked: {
    label: "Locked",
    bg: "bg-gray-100 border-gray-300",
    text: "text-gray-600",
    icon: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
    help: "This claim has been disputed too many times and can no longer be resubmitted",
  },
};

export default function StatusBadge({ status, showHelp = false }: { status: string; showHelp?: boolean }) {
  const c = config[status] || config.awaiting_org;

  return (
    <span className="inline-flex flex-col">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.bg} ${c.text}`}>
        {c.filled ? (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d={c.icon} clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
          </svg>
        )}
        {c.label}
      </span>
      {showHelp && c.help && (
        <span className="text-[11px] text-gray-400 mt-1 leading-tight">{c.help}</span>
      )}
    </span>
  );
}

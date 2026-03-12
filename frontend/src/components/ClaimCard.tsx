"use client";
import StatusBadge from "./StatusBadge";

type EmploymentClaim = {
  id: string; company_name: string; company_domain?: string; title: string;
  department?: string; employment_type: string; start_date: string;
  end_date?: string; is_current: boolean; status: string;
  verified_by_org?: string; corrected_title?: string;
  corrected_start_date?: string; corrected_end_date?: string;
  correction_reason?: string;
};

type EducationClaim = {
  id: string; institution: string; institution_domain?: string;
  degree: string; field_of_study?: string;
  start_date?: string; end_date?: string; status: string;
  verified_by_org?: string; corrected_degree?: string;
  corrected_field?: string; corrected_start_date?: string;
  corrected_end_date?: string; correction_reason?: string;
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1.5 rounded-lg hover:bg-red-50" title="Delete">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    </button>
  );
}

function CompanyLogo({ name, domain }: { name: string; domain?: string }) {
  if (domain) {
    return (
      <img
        src={`https://img.logo.dev/${domain}?token=pk_VAZ6tvAVSHOlMOFxJjH_Kw&size=64`}
        alt=""
        className="w-10 h-10 rounded-xl bg-gray-50 object-contain border border-gray-100"
        onError={(e) => {
          const el = e.target as HTMLImageElement;
          el.style.display = "none";
          el.parentElement!.innerHTML = `<div class="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-400">${name.charAt(0).toUpperCase()}</div>`;
        }}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-400">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function EmploymentCard({
  claim, onDelete, onAcceptCorrection, onDenyCorrection, onResend, onInvite,
}: {
  claim: EmploymentClaim;
  onDelete?: (id: string) => void;
  onAcceptCorrection?: (id: string) => void;
  onDenyCorrection?: (id: string) => void;
  onResend?: (id: string) => void;
  onInvite?: (name: string, domain: string) => void;
}) {
  const period = claim.is_current
    ? `${formatDate(claim.start_date)} — Present`
    : claim.end_date
      ? `${formatDate(claim.start_date)} — ${formatDate(claim.end_date)}`
      : formatDate(claim.start_date);
  const v = claim.status === "verified";

  return (
    <div className={`group relative bg-white rounded-xl p-5 border transition-all duration-200 hover:shadow-sm ${v ? "border-emerald-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0 flex-1">
          <CompanyLogo name={claim.company_name} domain={claim.company_domain} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-[15px] text-gray-900">{claim.title}</h3>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-gray-600 text-sm mt-0.5">{claim.company_name}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              <span>{period}</span>
              {claim.department && <><span className="w-1 h-1 rounded-full bg-gray-300" /><span>{claim.department}</span></>}
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>{formatType(claim.employment_type)}</span>
            </div>
            {v && claim.verified_by_org && (
              <p className="mt-2 text-xs text-emerald-600">Verified by {claim.verified_by_org}</p>
            )}
          </div>
        </div>
        {onDelete && <DeleteBtn onClick={() => onDelete(claim.id)} />}
      </div>

      {/* Correction proposed — show accept/deny */}
      {claim.status === "correction_proposed" && onAcceptCorrection && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm font-medium text-blue-900 mb-1">Correction proposed by employer:</p>
          {claim.corrected_title && <p className="text-sm text-blue-700">Title: {claim.corrected_title}</p>}
          {claim.corrected_start_date && <p className="text-sm text-blue-700">Start: {formatDate(claim.corrected_start_date)}</p>}
          {claim.corrected_end_date && <p className="text-sm text-blue-700">End: {formatDate(claim.corrected_end_date)}</p>}
          {claim.correction_reason && <p className="text-xs text-blue-500 mt-1">Reason: {claim.correction_reason}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => onAcceptCorrection(claim.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              Accept
            </button>
            <button onClick={() => onDenyCorrection?.(claim.id)} className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors">
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Awaiting org — show invite button */}
      {claim.status === "awaiting_org" && onInvite && claim.company_domain && (
        <div className="mt-3">
          <button
            onClick={() => onInvite(claim.company_name, claim.company_domain!)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Invite {claim.company_name} to join Stamp
          </button>
        </div>
      )}

      {/* Expired — show resend */}
      {claim.status === "expired" && onResend && (
        <button onClick={() => onResend(claim.id)} className="mt-3 text-xs font-medium text-amber-600 hover:text-amber-700">
          Resend verification request
        </button>
      )}
    </div>
  );
}

export function EducationCard({
  claim, onDelete, onAcceptCorrection, onDenyCorrection, onInvite,
}: {
  claim: EducationClaim;
  onDelete?: (id: string) => void;
  onAcceptCorrection?: (id: string) => void;
  onDenyCorrection?: (id: string) => void;
  onInvite?: (name: string, domain: string) => void;
}) {
  const dateRange = claim.start_date && claim.end_date
    ? `${formatDate(claim.start_date)} — ${formatDate(claim.end_date)}`
    : claim.end_date ? formatDate(claim.end_date)
    : claim.start_date ? `${formatDate(claim.start_date)} — Present` : "";
  const v = claim.status === "verified";

  return (
    <div className={`group relative bg-white rounded-xl p-5 border transition-all duration-200 hover:shadow-sm ${v ? "border-emerald-200" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-[15px] text-gray-900">{claim.degree}</h3>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-gray-600 text-sm mt-0.5">{claim.institution}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              {claim.field_of_study && <span>{claim.field_of_study}</span>}
              {claim.field_of_study && dateRange && <span className="w-1 h-1 rounded-full bg-gray-300" />}
              {dateRange && <span>{dateRange}</span>}
            </div>
            {v && claim.verified_by_org && (
              <p className="mt-2 text-xs text-emerald-600">Verified by {claim.verified_by_org}</p>
            )}
          </div>
        </div>
        {onDelete && <DeleteBtn onClick={() => onDelete(claim.id)} />}
      </div>

      {claim.status === "correction_proposed" && onAcceptCorrection && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm font-medium text-blue-900 mb-1">Correction proposed by institution:</p>
          {claim.corrected_degree && <p className="text-sm text-blue-700">Degree: {claim.corrected_degree}</p>}
          {claim.corrected_field && <p className="text-sm text-blue-700">Field: {claim.corrected_field}</p>}
          {claim.corrected_start_date && <p className="text-sm text-blue-700">Start: {formatDate(claim.corrected_start_date)}</p>}
          {claim.corrected_end_date && <p className="text-sm text-blue-700">End: {formatDate(claim.corrected_end_date)}</p>}
          {claim.correction_reason && <p className="text-xs text-blue-500 mt-1">Reason: {claim.correction_reason}</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={() => onAcceptCorrection(claim.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              Accept
            </button>
            <button onClick={() => onDenyCorrection?.(claim.id)} className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors">
              Deny
            </button>
          </div>
        </div>
      )}

      {claim.status === "awaiting_org" && onInvite && claim.institution_domain && (
        <div className="mt-3">
          <button
            onClick={() => onInvite(claim.institution, claim.institution_domain!)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Invite {claim.institution} to join Stamp
          </button>
        </div>
      )}
    </div>
  );
}

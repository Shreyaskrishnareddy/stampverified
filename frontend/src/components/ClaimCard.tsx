import StatusBadge from "./StatusBadge";

type EmploymentClaim = { id: string; company_name: string; title: string; department?: string; employment_type: string; start_date: string; end_date?: string; is_current: boolean; status: string; verifier_email?: string; };
type EducationClaim = { id: string; institution: string; degree: string; field_of_study?: string; year_started?: number; year_completed?: number; status: string; verifier_email?: string; };

function formatDate(d: string) { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
function formatType(t: string) { return t.replace(/_/g, "-").replace(/\b\w/g, c => c.toUpperCase()); }

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1.5 rounded-lg hover:bg-rose-50" title="Delete">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
    </button>
  );
}

function EmailStatus({ email, status }: { email?: string; status: string }) {
  if (!email || status === "verified") return null;
  return (
    <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-sky-600 bg-sky-50 border border-sky-100 rounded-lg px-2.5 py-1.5 w-fit">
      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
      <span>Verification sent to <strong className="font-semibold">{email}</strong></span>
    </div>
  );
}

export function EmploymentCard({ claim, onDelete }: { claim: EmploymentClaim; onDelete?: (id: string) => void }) {
  const period = claim.is_current ? `${formatDate(claim.start_date)} — Present` : claim.end_date ? `${formatDate(claim.start_date)} — ${formatDate(claim.end_date)}` : formatDate(claim.start_date);
  const v = claim.status === "verified";

  return (
    <div className={`group relative bg-white rounded-2xl p-5 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${v ? "verified-accent" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3.5 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${v ? "bg-sky-50 text-sky-600 border border-sky-200" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
            {claim.company_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 text-[15px]">{claim.title}</h3>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-slate-600 text-sm mt-0.5">{claim.company_name}</p>
            <div className="flex items-center gap-2.5 mt-1 text-[13px] text-slate-400">
              <span>{period}</span>
              {claim.department && <><span className="w-1 h-1 rounded-full bg-slate-300" /><span>{claim.department}</span></>}
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span>{formatType(claim.employment_type)}</span>
            </div>
            {onDelete && <EmailStatus email={claim.verifier_email} status={claim.status} />}
          </div>
        </div>
        {onDelete && claim.status !== "verified" && <DeleteBtn onClick={() => onDelete(claim.id)} />}
      </div>
    </div>
  );
}

export function EducationCard({ claim, onDelete }: { claim: EducationClaim; onDelete?: (id: string) => void }) {
  const years = claim.year_started && claim.year_completed ? `${claim.year_started} — ${claim.year_completed}` : claim.year_completed ? `Class of ${claim.year_completed}` : "";
  const v = claim.status === "verified";

  return (
    <div className={`group relative bg-white rounded-2xl p-5 border transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${v ? "verified-accent" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3.5 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${v ? "bg-sky-50 text-sky-600 border border-sky-200" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
            {claim.institution.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 text-[15px]">{claim.degree}</h3>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-slate-600 text-sm mt-0.5">{claim.institution}</p>
            <div className="flex items-center gap-2.5 mt-1 text-[13px] text-slate-400">
              {claim.field_of_study && <span>{claim.field_of_study}</span>}
              {claim.field_of_study && years && <span className="w-1 h-1 rounded-full bg-slate-300" />}
              {years && <span>{years}</span>}
            </div>
            {onDelete && <EmailStatus email={claim.verifier_email} status={claim.status} />}
          </div>
        </div>
        {onDelete && claim.status !== "verified" && <DeleteBtn onClick={() => onDelete(claim.id)} />}
      </div>
    </div>
  );
}

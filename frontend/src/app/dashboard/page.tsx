"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { EmploymentCard, EducationCard } from "@/components/ClaimCard";

type Profile = {
  id: string;
  username?: string;
  full_name: string;
  headline?: string;
  location?: string;
  avatar_url?: string;
  trust_score: number;
};

type Toast = { id: number; message: string; type: "success" | "error" };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium cursor-pointer ${
            t.type === "success"
              ? "bg-white border-sky-200 text-slate-900"
              : "bg-white border-rose-200 text-slate-900"
          }`}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === "success" ? (
            <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 skeleton" />
            <div className="w-16 h-5 skeleton" />
          </div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-4 skeleton" />
            <div className="w-8 h-8 rounded-full skeleton" />
          </div>
        </div>
      </nav>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-10">
          <div className="h-24 skeleton" style={{ borderRadius: 0 }} />
          <div className="px-8 pb-8 pt-4">
            <div className="flex items-end gap-4 -mt-14">
              <div className="w-20 h-20 rounded-2xl skeleton ring-4 ring-white" />
              <div className="space-y-2 mb-1">
                <div className="w-48 h-6 skeleton" />
                <div className="w-32 h-4 skeleton" />
              </div>
            </div>
            <div className="mt-8 flex items-center gap-8">
              <div className="space-y-1"><div className="w-8 h-7 skeleton" /><div className="w-14 h-3 skeleton" /></div>
              <div className="space-y-1"><div className="w-8 h-7 skeleton" /><div className="w-14 h-3 skeleton" /></div>
              <div className="space-y-1"><div className="w-8 h-7 skeleton" /><div className="w-14 h-3 skeleton" /></div>
            </div>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-10">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-5"><div className="w-32 h-6 skeleton" /><div className="w-16 h-8 skeleton rounded-xl" /></div>
            <div className="h-24 skeleton rounded-2xl" />
            <div className="h-24 skeleton rounded-2xl" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-5"><div className="w-28 h-6 skeleton" /><div className="w-16 h-8 skeleton rounded-xl" /></div>
            <div className="h-24 skeleton rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [userMeta, setUserMeta] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [employment, setEmployment] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showEmploymentForm, setShowEmploymentForm] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);

  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formHeadline, setFormHeadline] = useState("");
  const [formLocation, setFormLocation] = useState("");

  const [empCompany, setEmpCompany] = useState("");
  const [empTitle, setEmpTitle] = useState("");
  const [empDepartment, setEmpDepartment] = useState("");
  const [empType, setEmpType] = useState("full_time");
  const [empStartDate, setEmpStartDate] = useState("");
  const [empEndDate, setEmpEndDate] = useState("");
  const [empIsCurrent, setEmpIsCurrent] = useState(false);
  const [empVerifierEmail, setEmpVerifierEmail] = useState("");

  const [eduInstitution, setEduInstitution] = useState("");
  const [eduDegree, setEduDegree] = useState("");
  const [eduField, setEduField] = useState("");
  const [eduYearStarted, setEduYearStarted] = useState("");
  const [eduYearCompleted, setEduYearCompleted] = useState("");
  const [eduVerifierEmail, setEduVerifierEmail] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const p = await api.getMyProfile(accessToken);
      setProfile(p);
      setNeedsProfile(false);
    } catch {
      setNeedsProfile(true);
      setShowProfileForm(true);
    }
    try { setEmployment(await api.getEmploymentClaims(accessToken)); } catch {}
    try { setEducation(await api.getEducationClaims(accessToken)); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setToken(session.access_token);
      setUserMeta(session.user?.user_metadata);
      if (session.user?.user_metadata?.full_name) {
        setFormFullName(session.user.user_metadata.full_name);
      }
      loadData(session.access_token);
    });
  }, [router, loadData, supabase.auth]);

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push("/"); };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError("");
    try {
      if (needsProfile) {
        const p = await api.createProfile(token, {
          username: formUsername, full_name: formFullName,
          headline: formHeadline || undefined, location: formLocation || undefined,
        });
        setProfile(p); setNeedsProfile(false);
        addToast("Profile created successfully!");
      } else {
        const p = await api.updateProfile(token, {
          full_name: formFullName,
          headline: formHeadline || "",
          location: formLocation || "",
        });
        setProfile(p);
        addToast("Profile updated!");
      }
      setShowProfileForm(false);
    } catch (err: any) { setError(err.message); }
    setSubmitting(false);
  };

  const handleAddEmployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError("");
    try {
      await api.createEmploymentClaim(token, {
        company_name: empCompany, title: empTitle,
        department: empDepartment || undefined, employment_type: empType,
        start_date: empStartDate, end_date: empEndDate || undefined,
        is_current: empIsCurrent, verifier_email: empVerifierEmail || undefined,
      });
      setShowEmploymentForm(false); resetEmpForm(); loadData(token);
      addToast("Employment claim added! Verification email sent.");
    } catch (err: any) { setError(err.message); addToast(err.message, "error"); }
    setSubmitting(false);
  };

  const handleAddEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError("");
    try {
      await api.createEducationClaim(token, {
        institution: eduInstitution, degree: eduDegree,
        field_of_study: eduField || undefined,
        year_started: eduYearStarted ? parseInt(eduYearStarted) : undefined,
        year_completed: eduYearCompleted ? parseInt(eduYearCompleted) : undefined,
        verifier_email: eduVerifierEmail || undefined,
      });
      setShowEducationForm(false); resetEduForm(); loadData(token);
      addToast("Education claim added! Verification email sent.");
    } catch (err: any) { setError(err.message); addToast(err.message, "error"); }
    setSubmitting(false);
  };

  const handleDeleteEmp = async (id: string) => {
    if (!token) return;
    try { await api.deleteEmploymentClaim(token, id); loadData(token); addToast("Claim removed."); } catch {}
  };
  const handleDeleteEdu = async (id: string) => {
    if (!token) return;
    try { await api.deleteEducationClaim(token, id); loadData(token); addToast("Claim removed."); } catch {}
  };

  function resetEmpForm() { setEmpCompany(""); setEmpTitle(""); setEmpDepartment(""); setEmpType("full_time"); setEmpStartDate(""); setEmpEndDate(""); setEmpIsCurrent(false); setEmpVerifierEmail(""); }
  function resetEduForm() { setEduInstitution(""); setEduDegree(""); setEduField(""); setEduYearStarted(""); setEduYearCompleted(""); setEduVerifierEmail(""); }

  if (loading) return <DashboardSkeleton />;

  const totalClaims = employment.length + education.length;
  const verifiedClaims = [...employment, ...education].filter(c => c.status === "verified").length;
  const pendingClaims = [...employment, ...education].filter(c => c.status === "pending").length;
  const verifiedPercent = totalClaims > 0 ? Math.round((verifiedClaims / totalClaims) * 100) : 0;

  const inputCls = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-300 transition-colors";
  const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Nav */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            <span className="text-lg font-bold tracking-tight">Stamp</span>
          </div>
          <div className="flex items-center gap-5">
            {profile?.username && (
              <a href={`/profile/${profile.username}`} className="text-sm font-medium text-slate-400 hover:text-slate-900 transition-colors">
                Public profile
              </a>
            )}
            <button onClick={handleSignOut} className="text-sm font-medium text-slate-400 hover:text-slate-900 transition-colors">
              Sign out
            </button>
            {userMeta?.avatar_url && (
              <img src={userMeta.avatar_url} alt="" className="w-8 h-8 rounded-full ring-2 ring-slate-100" />
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Profile header */}
        {profile && (
          <div className="animate-fade-in bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
            <div className="h-24 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
            <div className="px-8 pb-8 -mt-10">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                <div className="flex items-end gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white shadow-lg">
                    {userMeta?.avatar_url ? (
                      <img src={userMeta.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover" />
                    ) : (
                      profile.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="mb-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
                      <button
                        onClick={() => { setFormUsername(profile.username || ""); setFormFullName(profile.full_name); setFormHeadline(profile.headline || ""); setFormLocation(profile.location || ""); setShowProfileForm(true); setError(""); }}
                        className="p-1 rounded-lg text-slate-300 hover:text-sky-600 hover:bg-sky-50 transition-all"
                        title="Edit profile"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                    </div>
                    {profile.headline && <p className="text-slate-500">{profile.headline}</p>}
                    {profile.location && (
                      <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {profile.location}
                      </p>
                    )}
                  </div>
                </div>
                {/* Verified count badge */}
                <div className="flex items-center gap-2.5 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-3">
                  <svg className="w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-lg font-bold text-sky-700">{verifiedClaims} <span className="text-sm font-medium text-sky-500">of {totalClaims}</span></p>
                    <p className="text-xs font-medium text-sky-500">verified</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {totalClaims > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-400">Verification progress</p>
                    <p className="text-xs font-bold text-sky-600">{verifiedPercent}%</p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="progress-bar h-full" style={{ width: `${verifiedPercent}%` }} />
                  </div>
                </div>
              )}

              {/* Stats bar */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-center gap-8">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalClaims}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Claims</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-sky-600">{verifiedClaims}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Verified</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{pendingClaims}</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Pending</p>
                </div>
                {profile.username && (
                  <div className="ml-auto flex items-center gap-2">
                    <p className="text-sm text-slate-400 font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      stampverified.com/{profile.username}
                    </p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`https://stampverified.com/${profile.username}`); addToast("Profile link copied!"); }}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-200 transition-all"
                      title="Copy link"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Claims grid */}
        <div className="grid lg:grid-cols-2 gap-10">
          {/* Employment */}
          <section className="animate-fade-in stagger-1">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Employment</h2>
              </div>
              <button
                onClick={() => { setShowEmploymentForm(true); setError(""); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add
              </button>
            </div>
            {employment.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-sky-300 hover:bg-sky-50/30 transition-all duration-300 cursor-pointer group" onClick={() => { setShowEmploymentForm(true); setError(""); }}>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-sky-100 to-sky-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-sky-700">Add your first job</p>
                <p className="text-xs text-slate-400 mt-1">Click to add a role and get it verified</p>
              </div>
            ) : (
              <div className="space-y-3">{employment.map(c => <EmploymentCard key={c.id} claim={c} onDelete={handleDeleteEmp} />)}</div>
            )}
          </section>

          {/* Education */}
          <section className="animate-fade-in stagger-2">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Education</h2>
              </div>
              <button
                onClick={() => { setShowEducationForm(true); setError(""); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add
              </button>
            </div>
            {education.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-sky-300 hover:bg-sky-50/30 transition-all duration-300 cursor-pointer group" onClick={() => { setShowEducationForm(true); setError(""); }}>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-sky-100 to-sky-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-7 h-7 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-sky-700">Add your education</p>
                <p className="text-xs text-slate-400 mt-1">Click to add a degree and get it verified</p>
              </div>
            ) : (
              <div className="space-y-3">{education.map(c => <EducationCard key={c.id} claim={c} onDelete={handleDeleteEdu} />)}</div>
            )}
          </section>
        </div>
      </div>

      {/* Profile creation modal */}
      {showProfileForm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">{needsProfile ? "Welcome to Stamp" : "Edit profile"}</h2>
                <p className="text-sm text-slate-500">Set up your verified identity</p>
              </div>
            </div>
            {error && <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4 border border-rose-100">{error}</div>}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {needsProfile && <div><label className={labelCls}>Username</label><input className={inputCls} value={formUsername} onChange={e => setFormUsername(e.target.value)} required placeholder="shreyas" /></div>}
              <div><label className={labelCls}>Full name</label><input className={inputCls} value={formFullName} onChange={e => setFormFullName(e.target.value)} required placeholder="Shreyas K" /></div>
              <div><label className={labelCls}>Headline</label><input className={inputCls} value={formHeadline} onChange={e => setFormHeadline(e.target.value)} placeholder="AI Engineer at Arytic" /></div>
              <div><label className={labelCls}>Location</label><input className={inputCls} value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Renton, WA" /></div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg shadow-slate-900/10" disabled={submitting}>
                {submitting ? "Saving..." : needsProfile ? "Create profile" : "Save changes"}
              </button>
              {!needsProfile && <button type="button" className="w-full text-slate-500 py-2.5 text-sm font-medium hover:text-slate-700" onClick={() => setShowProfileForm(false)}>Cancel</button>}
            </form>
          </div>
        </div>
      )}

      {/* Add employment modal */}
      {showEmploymentForm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Add employment</h2>
                <p className="text-sm text-slate-500">Add a role to verify</p>
              </div>
            </div>
            {error && <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4 border border-rose-100">{error}</div>}
            <form onSubmit={handleAddEmployment} className="space-y-4">
              <div><label className={labelCls}>Company</label><input className={inputCls} value={empCompany} onChange={e => setEmpCompany(e.target.value)} required placeholder="Acme Inc." /></div>
              <div><label className={labelCls}>Title</label><input className={inputCls} value={empTitle} onChange={e => setEmpTitle(e.target.value)} required placeholder="Software Engineer" /></div>
              <div><label className={labelCls}>Department</label><input className={inputCls} value={empDepartment} onChange={e => setEmpDepartment(e.target.value)} placeholder="Engineering" /></div>
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={empType} onChange={e => setEmpType(e.target.value)}>
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Start date</label><input className={inputCls} type="date" value={empStartDate} onChange={e => setEmpStartDate(e.target.value)} required /></div>
                <div><label className={labelCls}>End date</label><input className={inputCls} type="date" value={empEndDate} onChange={e => setEmpEndDate(e.target.value)} disabled={empIsCurrent} /></div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={empIsCurrent} onChange={e => { setEmpIsCurrent(e.target.checked); if (e.target.checked) setEmpEndDate(""); }} className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                I currently work here
              </label>
              <div className="pt-2 border-t border-slate-100">
                <label className={labelCls}>Verifier email</label>
                <input className={inputCls} type="email" value={empVerifierEmail} onChange={e => setEmpVerifierEmail(e.target.value)} placeholder="hr@company.com" />
                <p className="text-xs text-slate-400 mt-1.5">HR contact or manager who can confirm this role. We&apos;ll send them a simple verification link.</p>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg shadow-slate-900/10" disabled={submitting}>
                {submitting ? "Adding..." : "Add claim"}
              </button>
              <button type="button" className="w-full text-slate-500 py-2.5 text-sm font-medium hover:text-slate-700" onClick={() => { setShowEmploymentForm(false); resetEmpForm(); setError(""); }}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Add education modal */}
      {showEducationForm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Add education</h2>
                <p className="text-sm text-slate-500">Add a degree to verify</p>
              </div>
            </div>
            {error && <div className="bg-rose-50 text-rose-700 text-sm px-4 py-3 rounded-xl mb-4 border border-rose-100">{error}</div>}
            <form onSubmit={handleAddEducation} className="space-y-4">
              <div><label className={labelCls}>Institution</label><input className={inputCls} value={eduInstitution} onChange={e => setEduInstitution(e.target.value)} required placeholder="MIT" /></div>
              <div><label className={labelCls}>Degree</label><input className={inputCls} value={eduDegree} onChange={e => setEduDegree(e.target.value)} required placeholder="B.S. Computer Science" /></div>
              <div><label className={labelCls}>Field of study</label><input className={inputCls} value={eduField} onChange={e => setEduField(e.target.value)} placeholder="Computer Science" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Year started</label><input className={inputCls} type="number" value={eduYearStarted} onChange={e => setEduYearStarted(e.target.value)} placeholder="2018" /></div>
                <div><label className={labelCls}>Year completed</label><input className={inputCls} type="number" value={eduYearCompleted} onChange={e => setEduYearCompleted(e.target.value)} placeholder="2022" /></div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label className={labelCls}>Verifier email</label>
                <input className={inputCls} type="email" value={eduVerifierEmail} onChange={e => setEduVerifierEmail(e.target.value)} placeholder="registrar@university.edu" />
                <p className="text-xs text-slate-400 mt-1.5">Registrar or admin who can confirm this degree.</p>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-lg shadow-slate-900/10" disabled={submitting}>
                {submitting ? "Adding..." : "Add claim"}
              </button>
              <button type="button" className="w-full text-slate-500 py-2.5 text-sm font-medium hover:text-slate-700" onClick={() => { setShowEducationForm(false); resetEduForm(); setError(""); }}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

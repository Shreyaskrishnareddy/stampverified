"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import { EmploymentCard, EducationCard } from "@/components/ClaimCard";
import Navbar from "@/components/Navbar";
import CompanyAutocomplete from "@/components/CompanyAutocomplete";
import UniversityAutocomplete from "@/components/UniversityAutocomplete";

type Profile = {
  id: string;
  username?: string;
  full_name: string;
  headline?: string;
  location?: string;
  avatar_url?: string;
};

type Toast = { id: number; message: string; type: "success" | "error" };

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium cursor-pointer ${
            t.type === "success" ? "bg-white border-emerald-200 text-gray-900" : "bg-white border-red-200 text-gray-900"
          }`}
          onClick={() => onDismiss(t.id)}
        >
          {t.type === "success" ? (
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-10">
          <div className="h-24 skeleton" style={{ borderRadius: 0 }} />
          <div className="px-8 pb-8 pt-4">
            <div className="flex items-end gap-4 -mt-14">
              <div className="w-20 h-20 rounded-2xl skeleton ring-4 ring-white" />
              <div className="space-y-2 mb-1">
                <div className="w-48 h-6 skeleton" />
                <div className="w-32 h-4 skeleton" />
              </div>
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
  const [userMeta, setUserMeta] = useState<Record<string, string> | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [employment, setEmployment] = useState<Record<string, unknown>[]>([]);
  const [education, setEducation] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showEmploymentForm, setShowEmploymentForm] = useState(false);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCompany, setInviteCompany] = useState({ name: "", domain: "" });
  const [inviteLink, setInviteLink] = useState("");

  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formHeadline, setFormHeadline] = useState("");
  const [formLocation, setFormLocation] = useState("");

  const [empCompany, setEmpCompany] = useState("");
  const [empCompanyDomain, setEmpCompanyDomain] = useState("");
  const [empTitle, setEmpTitle] = useState("");
  const [empDepartment, setEmpDepartment] = useState("");
  const [empType, setEmpType] = useState("full_time");
  const [empStartDate, setEmpStartDate] = useState("");
  const [empEndDate, setEmpEndDate] = useState("");
  const [empIsCurrent, setEmpIsCurrent] = useState(false);

  const [eduInstitution, setEduInstitution] = useState("");
  const [eduInstitutionDomain, setEduInstitutionDomain] = useState("");
  const [eduDegree, setEduDegree] = useState("");
  const [eduDegreeCustom, setEduDegreeCustom] = useState("");
  const [eduField, setEduField] = useState("");
  const [eduFieldCustom, setEduFieldCustom] = useState("");
  const [eduStartDate, setEduStartDate] = useState("");
  const [eduEndDate, setEduEndDate] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const autoCreateProfile = useCallback(async (accessToken: string, meta: Record<string, string> | null, email: string) => {
    const fullName = (meta?.full_name as string) || (meta?.name as string) || email.split("@")[0];
    const username = email.split("@")[0].replace(/[^a-z0-9._-]/gi, "").toLowerCase();
    try {
      const p = await api.createProfile(accessToken, { username, full_name: fullName });
      setProfile(p);
      setNeedsProfile(false);
      addToast("Profile created automatically!");
    } catch {
      // Username might be taken — try with random suffix
      try {
        const p = await api.createProfile(accessToken, {
          username: `${username}${Math.floor(Math.random() * 1000)}`,
          full_name: fullName,
        });
        setProfile(p);
        setNeedsProfile(false);
        addToast("Profile created! You can edit your username anytime.");
      } catch {
        // Fall back to manual profile creation
        setNeedsProfile(true);
        setShowProfileForm(true);
      }
    }
  }, [addToast]);

  const reloadClaims = useCallback(async (accessToken: string) => {
    try { const p = await api.getMyProfile(accessToken); setProfile(p); } catch { /* empty */ }
    try { setEmployment(await api.getEmploymentClaims(accessToken)); } catch { /* empty */ }
    try { setEducation(await api.getEducationClaims(accessToken)); } catch { /* empty */ }
  }, []);

  const loadData = useCallback(async (accessToken: string, meta: Record<string, string> | null, email: string) => {
    try {
      const p = await api.getMyProfile(accessToken);
      setProfile(p);
      setNeedsProfile(false);
    } catch {
      // No profile yet — auto-create from auth metadata
      await autoCreateProfile(accessToken, meta, email);
    }
    try { setEmployment(await api.getEmploymentClaims(accessToken)); } catch { /* empty */ }
    try { setEducation(await api.getEducationClaims(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [autoCreateProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setToken(session.access_token);
      const meta = (session.user?.user_metadata as Record<string, string>) || null;
      setUserMeta(meta);
      if (meta?.full_name) {
        setFormFullName(meta.full_name as string);
      }
      loadData(session.access_token, meta, session.user?.email || "");
    });
  }, [router, loadData, supabase.auth]);

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
        addToast("Profile created!");
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
    } catch (err: unknown) { setError((err as Error).message); }
    setSubmitting(false);
  };

  const handleAddEmployment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError("");
    try {
      await api.createEmploymentClaim(token, {
        company_name: empCompany,
        company_domain: empCompanyDomain || undefined,
        title: empTitle,
        department: empDepartment || undefined,
        employment_type: empType,
        start_date: empStartDate,
        end_date: empEndDate || undefined,
        is_current: empIsCurrent,
      });
      setShowEmploymentForm(false); resetEmpForm(); reloadClaims(token);
      addToast("Employment claim added!");
    } catch (err: unknown) { setError((err as Error).message); addToast((err as Error).message, "error"); }
    setSubmitting(false);
  };

  const handleAddEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError("");
    try {
      const finalDegree = eduDegree === "Other" ? eduDegreeCustom : eduDegree;
      const finalField = eduField === "Other" ? eduFieldCustom : eduField;
      await api.createEducationClaim(token, {
        institution: eduInstitution,
        institution_domain: eduInstitutionDomain || undefined,
        degree: finalDegree,
        field_of_study: finalField || undefined,
        start_date: eduStartDate || undefined,
        end_date: eduEndDate || undefined,
      });
      setShowEducationForm(false); resetEduForm(); reloadClaims(token);
      addToast("Education claim added!");
    } catch (err: unknown) { setError((err as Error).message); addToast((err as Error).message, "error"); }
    setSubmitting(false);
  };

  const handleDeleteEmp = async (id: string) => {
    if (!token) return;
    try { await api.deleteEmploymentClaim(token, id); reloadClaims(token); addToast("Claim removed."); } catch { /* empty */ }
  };
  const handleDeleteEdu = async (id: string) => {
    if (!token) return;
    try { await api.deleteEducationClaim(token, id); reloadClaims(token); addToast("Claim removed."); } catch { /* empty */ }
  };

  const handleAcceptEmpCorrection = async (id: string) => {
    if (!token) return;
    try { await api.acceptEmploymentCorrection(token, id); reloadClaims(token); addToast("Correction accepted!"); } catch { /* empty */ }
  };
  const handleDenyEmpCorrection = async (id: string) => {
    if (!token) return;
    const reason = prompt("Why are you denying this correction?");
    if (!reason) return;
    try { await api.denyEmploymentCorrection(token, id, reason); reloadClaims(token); addToast("Correction denied."); } catch { /* empty */ }
  };
  const handleAcceptEduCorrection = async (id: string) => {
    if (!token) return;
    try { await api.acceptEducationCorrection(token, id); reloadClaims(token); addToast("Correction accepted!"); } catch { /* empty */ }
  };
  const handleDenyEduCorrection = async (id: string) => {
    if (!token) return;
    const reason = prompt("Why are you denying this correction?");
    if (!reason) return;
    try { await api.denyEducationCorrection(token, id, reason); reloadClaims(token); addToast("Correction denied."); } catch { /* empty */ }
  };
  const handleResendEmp = async (id: string) => {
    if (!token) return;
    try { await api.resendEmploymentVerification(token, id); addToast("Verification request resent!"); } catch { /* empty */ }
  };

  const handleInvite = async (name: string, domain: string) => {
    if (!token) return;
    setInviteCompany({ name, domain });
    setInviteLink("");
    setShowInviteModal(true);
    try {
      const result = await api.generateInviteLink(token, name, domain);
      setInviteLink(result.invite_url || result.link || "");
    } catch { addToast("Could not generate invite link", "error"); setShowInviteModal(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const result = await api.uploadAvatar(token, file);
      setProfile(prev => prev ? { ...prev, avatar_url: result.avatar_url } : prev);
      addToast("Avatar updated!");
    } catch { addToast("Avatar upload failed", "error"); }
  };

  function resetEmpForm() { setEmpCompany(""); setEmpCompanyDomain(""); setEmpTitle(""); setEmpDepartment(""); setEmpType("full_time"); setEmpStartDate(""); setEmpEndDate(""); setEmpIsCurrent(false); }
  function resetEduForm() { setEduInstitution(""); setEduInstitutionDomain(""); setEduDegree(""); setEduDegreeCustom(""); setEduField(""); setEduFieldCustom(""); setEduStartDate(""); setEduEndDate(""); }

  if (loading) return <DashboardSkeleton />;

  const totalClaims = employment.length + education.length;
  const verifiedClaims = [...employment, ...education].filter(c => c.status === "verified").length;
  const pendingClaims = [...employment, ...education].filter(c => ["awaiting_verification", "awaiting_org"].includes(c.status as string)).length;

  const inputCls = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400";
  const labelCls = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Profile header */}
        {profile && (
          <div className="animate-fade-in bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-10">
            <div className="px-8 py-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer group relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg overflow-hidden">
                      {profile.avatar_url || userMeta?.avatar_url ? (
                        <img src={profile.avatar_url || userMeta?.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                      ) : (
                        profile.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                  <div className="mb-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-gray-900">{profile.full_name}</h1>
                      <button
                        onClick={() => { setFormUsername(profile.username || ""); setFormFullName(profile.full_name); setFormHeadline(profile.headline || ""); setFormLocation(profile.location || ""); setShowProfileForm(true); setError(""); }}
                        className="p-1 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        title="Edit profile"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                      </button>
                    </div>
                    {profile.headline && <p className="text-gray-500">{profile.headline}</p>}
                    {profile.location && (
                      <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {profile.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
                  <div>
                    <p className="text-lg font-bold text-emerald-700">{verifiedClaims} <span className="text-sm font-medium text-emerald-500">of {totalClaims}</span></p>
                    <p className="text-xs font-medium text-emerald-500">verified</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-8">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalClaims}</p>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Claims</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{verifiedClaims}</p>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Verified</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{pendingClaims}</p>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">In Progress</p>
                </div>
                {profile.username && (
                  <div className="ml-auto flex items-center gap-2">
                    <p className="text-sm text-gray-400 font-mono bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      stampverified.com/{profile.username}
                    </p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`https://stampverified.com/${profile.username}`); addToast("Profile link copied!"); }}
                      className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
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
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900">Employment</h2>
              </div>
              <button
                onClick={() => { setShowEmploymentForm(true); setError(""); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add
              </button>
            </div>
            {employment.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group" onClick={() => { setShowEmploymentForm(true); setError(""); }}>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
                </div>
                <p className="text-sm font-semibold text-gray-600 group-hover:text-blue-700">Add your first job</p>
                <p className="text-xs text-gray-400 mt-1">Click to add a role and get it verified</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employment.map((c: Record<string, unknown>) => (
                  <EmploymentCard
                    key={c.id as string}
                    claim={c as never}
                    onDelete={handleDeleteEmp}
                    onAcceptCorrection={handleAcceptEmpCorrection}
                    onDenyCorrection={handleDenyEmpCorrection}
                    onResend={handleResendEmp}
                    onInvite={handleInvite}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Education */}
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900">Education</h2>
              </div>
              <button
                onClick={() => { setShowEducationForm(true); setError(""); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add
              </button>
            </div>
            {education.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group" onClick={() => { setShowEducationForm(true); setError(""); }}>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
                </div>
                <p className="text-sm font-semibold text-gray-600 group-hover:text-blue-700">Add your education</p>
                <p className="text-xs text-gray-400 mt-1">Click to add a degree and get it verified</p>
              </div>
            ) : (
              <div className="space-y-3">
                {education.map((c: Record<string, unknown>) => (
                  <EducationCard
                    key={c.id as string}
                    claim={c as never}
                    onDelete={handleDeleteEdu}
                    onAcceptCorrection={handleAcceptEduCorrection}
                    onDenyCorrection={handleDenyEduCorrection}
                    onInvite={handleInvite}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Profile creation/edit modal */}
      {showProfileForm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">{needsProfile ? "Complete your profile" : "Edit profile"}</h2>
                <p className="text-sm text-gray-500">{needsProfile ? "Choose a username to get started" : "Update your details"}</p>
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {needsProfile && <div><label className={labelCls}>Username</label><input className={inputCls} value={formUsername} onChange={e => setFormUsername(e.target.value)} required placeholder="johndoe" /></div>}
              <div><label className={labelCls}>Full name</label><input className={inputCls} value={formFullName} onChange={e => setFormFullName(e.target.value)} required placeholder="John Doe" /></div>
              <div><label className={labelCls}>Headline</label><input className={inputCls} value={formHeadline} onChange={e => setFormHeadline(e.target.value)} placeholder="Software Engineer at Google" /></div>
              <div><label className={labelCls}>Location</label><input className={inputCls} value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="San Francisco, CA" /></div>
              <button type="submit" className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50" disabled={submitting}>
                {submitting ? "Saving..." : needsProfile ? "Create profile" : "Save changes"}
              </button>
              {!needsProfile && <button type="button" className="w-full text-gray-500 py-2.5 text-sm font-medium hover:text-gray-700" onClick={() => setShowProfileForm(false)}>Cancel</button>}
            </form>
          </div>
        </div>
      )}

      {/* Add employment modal */}
      {showEmploymentForm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Add employment</h2>
                <p className="text-sm text-gray-500">Search and select your company</p>
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
            <form onSubmit={handleAddEmployment} className="space-y-4">
              <div>
                <label className={labelCls}>Company</label>
                <CompanyAutocomplete
                  value={empCompany}
                  domain={empCompanyDomain}
                  onChange={(name, domain) => { setEmpCompany(name); setEmpCompanyDomain(domain); }}
                  placeholder="Search company..."
                />
              </div>
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
              <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={empIsCurrent} onChange={e => { setEmpIsCurrent(e.target.checked); if (e.target.checked) setEmpEndDate(""); }} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                I currently work here
              </label>
              <p className="text-xs text-gray-400">
                {empCompanyDomain
                  ? "We'll notify the company to verify this claim."
                  : "If the company isn't on Stamp yet, you can invite them after adding this claim."}
              </p>
              <button type="submit" className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50" disabled={submitting}>
                {submitting ? "Adding..." : "Add claim"}
              </button>
              <button type="button" className="w-full text-gray-500 py-2.5 text-sm font-medium hover:text-gray-700" onClick={() => { setShowEmploymentForm(false); resetEmpForm(); setError(""); }}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Add education modal */}
      {showEducationForm && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold">Add education</h2>
                <p className="text-sm text-gray-500">Search and select your institution</p>
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
            <form onSubmit={handleAddEducation} className="space-y-4">
              <div>
                <label className={labelCls}>Institution</label>
                <UniversityAutocomplete
                  value={eduInstitution}
                  domain={eduInstitutionDomain}
                  onChange={(name, domain) => { setEduInstitution(name); setEduInstitutionDomain(domain); }}
                  placeholder="Search university..."
                />
              </div>
              <div>
                <label className={labelCls}>Degree</label>
                <select className={inputCls} value={eduDegree} onChange={e => setEduDegree(e.target.value)} required>
                  <option value="">Select degree...</option>
                  <option value="Associate's Degree">Associate&apos;s Degree</option>
                  <option value="Bachelor's Degree">Bachelor&apos;s Degree</option>
                  <option value="Master's Degree">Master&apos;s Degree</option>
                  <option value="Doctoral Degree (PhD)">Doctoral Degree (PhD)</option>
                  <option value="MBA">MBA</option>
                  <option value="MD">MD</option>
                  <option value="JD">JD</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Certificate">Certificate</option>
                  <option value="Other">Other</option>
                </select>
                {eduDegree === "Other" && (
                  <input className={`${inputCls} mt-2`} value={eduDegreeCustom} onChange={e => setEduDegreeCustom(e.target.value)} required placeholder="Enter your degree" />
                )}
              </div>
              <div>
                <label className={labelCls}>Field of study</label>
                <select className={inputCls} value={eduField} onChange={e => setEduField(e.target.value)}>
                  <option value="">Select field...</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Business Administration">Business Administration</option>
                  <option value="Economics">Economics</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Law">Law</option>
                  <option value="Psychology">Psychology</option>
                  <option value="Finance">Finance</option>
                  <option value="Accounting">Accounting</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Architecture">Architecture</option>
                  <option value="Design">Design</option>
                  <option value="Communications">Communications</option>
                  <option value="Education">Education</option>
                  <option value="Nursing">Nursing</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Political Science">Political Science</option>
                  <option value="Sociology">Sociology</option>
                  <option value="Philosophy">Philosophy</option>
                  <option value="History">History</option>
                  <option value="English">English</option>
                  <option value="Other">Other</option>
                </select>
                {eduField === "Other" && (
                  <input className={`${inputCls} mt-2`} value={eduFieldCustom} onChange={e => setEduFieldCustom(e.target.value)} required placeholder="Enter your field of study" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Start date</label><input className={inputCls} type="date" value={eduStartDate} onChange={e => setEduStartDate(e.target.value)} /></div>
                <div><label className={labelCls}>End date</label><input className={inputCls} type="date" value={eduEndDate} onChange={e => setEduEndDate(e.target.value)} /></div>
              </div>
              <button type="submit" className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50" disabled={submitting}>
                {submitting ? "Adding..." : "Add claim"}
              </button>
              <button type="button" className="w-full text-gray-500 py-2.5 text-sm font-medium hover:text-gray-700" onClick={() => { setShowEducationForm(false); resetEduForm(); setError(""); }}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-2">Invite {inviteCompany.name}</h2>
            <p className="text-sm text-gray-500 mb-6">Share this link with someone at {inviteCompany.name} to get them on Stamp.</p>
            {inviteLink ? (
              <div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 break-all text-sm text-gray-700 font-mono mb-4">
                  {inviteLink}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteLink); addToast("Invite link copied!"); }}
                  className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Copy link
                </button>
              </div>
            ) : (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
              </div>
            )}
            <button onClick={() => setShowInviteModal(false)} className="w-full text-gray-500 py-2.5 text-sm font-medium hover:text-gray-700 mt-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

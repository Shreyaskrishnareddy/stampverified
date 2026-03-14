"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Candidate = {
  user_id: string;
  full_name: string;
  username: string;
  headline: string | null;
  location: string | null;
  resume_available: boolean;
  verified_employment: { company_name: string; title: string; is_current: boolean }[];
  verified_education: { institution: string; degree: string }[];
  verified_count: number;
};

type Job = { id: string; title: string };

export default function TalentSearchPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [orgJobs, setOrgJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Search filters
  const [titleQuery, setTitleQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  // Outreach modal
  const [outreachTarget, setOutreachTarget] = useState<Candidate | null>(null);
  const [outreachJobId, setOutreachJobId] = useState("");
  const [outreachMessage, setOutreachMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const [results, jobs] = await Promise.all([
        api.searchTalent(accessToken),
        api.getEmployerJobs(accessToken, "active"),
      ]);
      setCandidates(results);
      const activeJobs = (jobs as Record<string, unknown>[]).map((j) => ({ id: j.id as string, title: j.title as string }));
      setOrgJobs(activeJobs);
      if (activeJobs.length > 0) setOutreachJobId(activeJobs[0].id);
    } catch {
      router.push("/for-employers");
      return;
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/for-employers"); return; }
      setToken(session.access_token);
      loadData(session.access_token);
    });
  }, [router, loadData, supabase.auth]);

  const handleSearch = async () => {
    if (!token) return;
    setSearching(true);
    try {
      const params: Record<string, string> = {};
      if (titleQuery) params.title = titleQuery;
      if (companyQuery) params.company = companyQuery;
      if (locationQuery) params.location = locationQuery;
      const results = await api.searchTalent(token, params);
      setCandidates(results);
    } catch { /* empty */ }
    setSearching(false);
  };

  const handleOutreach = async () => {
    if (!token || !outreachTarget || !outreachJobId || !outreachMessage.trim()) return;
    setSending(true);
    try {
      await api.sendOutreach(token, {
        candidate_id: outreachTarget.user_id,
        job_id: outreachJobId,
        message: outreachMessage.trim(),
      });
      setToast({ message: `Outreach sent to ${outreachTarget.full_name}`, type: "success" });
      setOutreachTarget(null);
      setOutreachMessage("");
      setTimeout(() => setToast(null), 4000);
    } catch (err: unknown) {
      setToast({ message: (err as Error).message, type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${toast.type === "success" ? "bg-white border-emerald-200" : "bg-white border-red-200"}`}>
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Talent Search</h1>
            <p className="text-sm text-gray-500 mt-1">Discover candidates with confirmed experience who are open to opportunities.</p>
          </div>
          <Link href="/employer/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</Link>
        </div>

        {/* Search filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Job title</label>
              <input
                type="text"
                value={titleQuery}
                onChange={e => setTitleQuery(e.target.value)}
                placeholder="Software Engineer"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Company</label>
              <input
                type="text"
                value={companyQuery}
                onChange={e => setCompanyQuery(e.target.value)}
                placeholder="Google"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</label>
              <input
                type="text"
                value={locationQuery}
                onChange={e => setLocationQuery(e.target.value)}
                placeholder="San Francisco"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="mt-4 bg-[#0A0A0A] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Results */}
        {candidates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">No matching candidates</p>
            <p className="text-sm text-gray-400">Try different search terms or check back as more candidates join.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-2">{candidates.length} candidate{candidates.length !== 1 ? "s" : ""} found</p>
            {candidates.map(candidate => (
              <div key={candidate.user_id} className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/${candidate.username}`} className="font-semibold text-gray-900 hover:text-gray-700">
                        {candidate.full_name}
                      </Link>
                      <span className="text-xs text-gray-400">{candidate.verified_count} confirmed</span>
                    </div>
                    {candidate.headline && <p className="text-sm text-gray-500">{candidate.headline}</p>}
                    {candidate.location && <p className="text-xs text-gray-400 mt-0.5">{candidate.location}</p>}

                    {/* Verified claims */}
                    <div className="mt-3 space-y-1">
                      {candidate.verified_employment.slice(0, 3).map((claim, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-3.5 h-3.5 flex-shrink-0"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-gray-600">{claim.title} at {claim.company_name}</span>
                          {claim.is_current && <span className="text-[10px] text-gray-400">(current)</span>}
                        </div>
                      ))}
                      {candidate.verified_education.slice(0, 2).map((claim, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-3.5 h-3.5 flex-shrink-0"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <span className="text-gray-600">{claim.degree}, {claim.institution}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {candidate.resume_available && (
                      <span className="text-[10px] text-gray-400">Resume available</span>
                    )}
                    <button
                      onClick={() => { setOutreachTarget(candidate); setOutreachMessage(""); }}
                      disabled={orgJobs.length === 0}
                      className="px-4 py-2 text-sm font-semibold text-white bg-[#0A0A0A] hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Reach out
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outreach modal */}
      {outreachTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="animate-scale-in bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Reach out to {outreachTarget.full_name}</h2>
            <p className="text-sm text-gray-500 mb-6">Select a role and write a short note.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role *</label>
                <select
                  value={outreachJobId}
                  onChange={e => setOutreachJobId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  {orgJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
                <textarea
                  value={outreachMessage}
                  onChange={e => setOutreachMessage(e.target.value)}
                  maxLength={300}
                  placeholder="Hi, your experience caught my eye..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none h-24"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{outreachMessage.length}/300</p>
              </div>

              <button
                onClick={handleOutreach}
                disabled={sending || !outreachMessage.trim() || !outreachJobId}
                className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send outreach"}
              </button>
              <button onClick={() => setOutreachTarget(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

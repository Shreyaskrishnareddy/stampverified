"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";

type TeamMember = { id: string; email: string; role: string };

export default function NewJobPage() {
  const router = useRouter();
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"paste" | "review">("paste");

  // Paste step
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);

  // Review step (auto-filled from extraction, editable)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationType, setLocationType] = useState("onsite");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [showPocName, setShowPocName] = useState(false);
  const [pocMemberId, setPocMemberId] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Which fields were auto-extracted
  const [extracted, setExtracted] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const membership = await api.getMyMembership(accessToken);
      if (!membership.can_post_jobs && membership.role !== "admin") {
        router.push("/employer/dashboard");
        return;
      }
      setPocMemberId(membership.id);

      const team = await api.getTeamMembers(accessToken);
      setTeamMembers(team.filter((m: TeamMember) => m.role === "admin" || m.email));
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

  const handleExtract = async () => {
    if (!token || !pastedText.trim()) return;
    setExtracting(true);
    setError("");

    try {
      const result = await api.extractJD(token, pastedText);

      // Populate fields from extraction
      if (result.title) { setTitle(result.title); setExtracted(p => ({ ...p, title: true })); }
      if (result.salary_min) { setSalaryMin(String(result.salary_min)); setExtracted(p => ({ ...p, salary: true })); }
      if (result.salary_max) { setSalaryMax(String(result.salary_max)); setExtracted(p => ({ ...p, salary: true })); }
      if (result.location) { setLocation(result.location); setExtracted(p => ({ ...p, location: true })); }
      if (result.location_type) { setLocationType(result.location_type); setExtracted(p => ({ ...p, location_type: true })); }
      if (result.employment_type) { setEmploymentType(result.employment_type); setExtracted(p => ({ ...p, employment_type: true })); }
      if (result.experience_level) { setExperienceLevel(result.experience_level); setExtracted(p => ({ ...p, experience_level: true })); }
      setDescription(result.description || pastedText);

      setStep("review");
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setExtracting(false);
  };

  const handleSkipExtract = () => {
    setDescription(pastedText);
    setStep("review");
  };

  const handlePublish = async () => {
    if (!token) return;
    setPublishing(true);
    setError("");

    if (!title.trim()) { setError("Job title is required"); setPublishing(false); return; }
    if (!description.trim()) { setError("Job description is required"); setPublishing(false); return; }
    if (!salaryMin || !salaryMax) { setError("Salary range is required"); setPublishing(false); return; }

    const minVal = parseInt(salaryMin);
    const maxVal = parseInt(salaryMax);
    if (isNaN(minVal) || isNaN(maxVal)) { setError("Salary must be a number"); setPublishing(false); return; }
    if (maxVal < minVal) { setError("Maximum salary must be greater than minimum"); setPublishing(false); return; }

    try {
      await api.createJob(token, {
        title: title.trim(),
        description: description.trim(),
        location: location || null,
        location_type: locationType,
        employment_type: employmentType,
        experience_level: experienceLevel,
        salary_min: minVal,
        salary_max: maxVal,
        salary_currency: salaryCurrency,
        show_poc_name: showPocName,
        poc_member_id: pocMemberId || null,
      });
      router.push("/employer/jobs");
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setPublishing(false);
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

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Post a Job</h1>
          <button
            onClick={() => router.push("/employer/jobs")}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-6 border border-red-100">
            {error}
          </div>
        )}

        {/* Step 1: Paste JD or URL */}
        {step === "paste" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Paste your job description or link</h2>
            <p className="text-sm text-gray-500 mb-6">
              Paste from your careers page, Google Doc, or ATS — or paste a Greenhouse, Lever, or Ashby job URL. We&apos;ll extract the details automatically.
            </p>

            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder={"Paste job description text or a URL...\n\ne.g. https://boards.greenhouse.io/yourcompany/jobs/12345"}
              className="w-full h-64 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
              autoFocus
            />

            {/* URL detection indicator */}
            {pastedText.trim().match(/^https?:\/\//) && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                URL detected — we&apos;ll import the job details from the page
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handleSkipExtract}
                disabled={!pastedText.trim()}
                className="text-sm text-gray-400 hover:text-gray-600 disabled:invisible"
              >
                Skip extraction, fill manually
              </button>
              <button
                onClick={handleExtract}
                disabled={extracting || !pastedText.trim()}
                className="bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {extracting ? (pastedText.trim().match(/^https?:\/\//) ? "Importing from URL..." : "Extracting...") : "Extract & Continue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Review & Publish */}
        {step === "review" && (
          <div className="space-y-6 animate-fade-in">
            {Object.keys(extracted).length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-sm text-emerald-700">
                {pastedText.trim().match(/^https?:\/\//)
                  ? `Imported from URL. Extracted: ${Object.keys(extracted).join(", ")}. Review and edit below.`
                  : `Auto-extracted: ${Object.keys(extracted).join(", ")}. Review and edit below.`
                }
              </div>
            )}

            {/* Quick details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Job details</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Title {extracted.title && <span className="text-emerald-500 text-xs font-normal ml-1">auto-detected</span>}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    placeholder="Senior Software Engineer"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="San Francisco"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work style</label>
                    <select value={locationType} onChange={e => setLocationType(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                      <option value="onsite">Onsite</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="remote">Remote</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                    <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                      <option value="full_time">Full-time</option>
                      <option value="part_time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Level</label>
                    <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                      <option value="entry">Entry</option>
                      <option value="mid">Mid</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Salary range *{extracted.salary && <span className="text-emerald-500 text-xs font-normal ml-1">auto-detected</span>}
                  </label>
                  <div className="flex items-center gap-3">
                    <select value={salaryCurrency} onChange={e => setSalaryCurrency(e.target.value)} className="px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm w-20">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="INR">INR</option>
                    </select>
                    <input
                      type="number"
                      value={salaryMin}
                      onChange={e => setSalaryMin(e.target.value)}
                      placeholder="Min"
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="number"
                      value={salaryMax}
                      onChange={e => setSalaryMax(e.target.value)}
                      placeholder="Max"
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-2">Description</h2>
              <p className="text-xs text-gray-400 mb-4">Your pasted job description. Edit if needed.</p>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            {/* POC & visibility */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Contact & visibility</h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Point of contact</label>
                  <select
                    value={pocMemberId}
                    onChange={e => setPocMemberId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  >
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.email}{m.role === "admin" ? " (Admin)" : ""}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Internal contact for this role. Candidates see this after applying.</p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPocName}
                    onChange={e => setShowPocName(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Show contact name publicly</span>
                    <p className="text-xs text-gray-400">If off, job shows company name only. Candidates with verified claims always see the contact.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep("paste"); setExtracted({}); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Back to paste
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="bg-[#0A0A0A] text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish Job"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

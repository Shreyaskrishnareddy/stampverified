"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { EmploymentCard, EducationCard } from "@/components/ClaimCard";

export default function PublicProfile() {
  const params = useParams();
  const username = params.username as string;

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicProfile(username)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
          <p className="text-slate-500 mb-6">This profile doesn&apos;t exist or has been removed.</p>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-xl transition-colors">
            Go to Stamp
          </a>
        </div>
      </div>
    );
  }

  const { profile, employment, education } = data;
  const totalClaims = employment.length + education.length;
  const verifiedClaims = [...employment, ...education].filter((c: any) => c.status === "verified").length;

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <svg className="w-6 h-6 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
            <span className="text-lg font-bold tracking-tight">Stamp</span>
          </a>
          <span className="text-sm text-slate-400">Verified profile</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header card */}
        <div className="animate-fade-in bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
          <div className="h-20 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900" />
          <div className="px-8 pb-8 -mt-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-500 flex items-center justify-center text-white text-xl font-bold ring-4 ring-white shadow-lg">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-16 h-16 rounded-2xl object-cover" />
                  ) : (
                    profile.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="mb-0.5">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
                    {verifiedClaims > 0 && (
                      <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                      </svg>
                    )}
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

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-6 text-sm">
              <span className="text-slate-400"><strong className="text-slate-900 font-semibold">{totalClaims}</strong> claims</span>
              <span className="text-slate-400"><strong className="text-sky-600 font-semibold">{verifiedClaims}</strong> verified</span>
            </div>
          </div>
        </div>

        {/* Employment */}
        {employment.length > 0 && (
          <section className="animate-fade-in stagger-1 mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Employment</h2>
            </div>
            <div className="space-y-3">{employment.map((c: any) => <EmploymentCard key={c.id} claim={c} />)}</div>
          </section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <section className="animate-fade-in stagger-2 mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Education</h2>
            </div>
            <div className="space-y-3">{education.map((c: any) => <EducationCard key={c.id} claim={c} />)}</div>
          </section>
        )}

        {employment.length === 0 && education.length === 0 && (
          <p className="text-center text-slate-400 py-16">No claims added yet.</p>
        )}
      </div>

      <footer className="border-t border-slate-100 py-8 px-6 text-center">
        <p className="text-sm text-slate-400">
          Verified on <a href="/" className="font-semibold text-slate-600 hover:text-slate-900 transition-colors">stampverified.com</a>
        </p>
      </footer>
    </div>
  );
}

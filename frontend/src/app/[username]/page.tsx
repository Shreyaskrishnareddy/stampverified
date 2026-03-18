"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { EmploymentCard, EducationCard } from "@/components/ClaimCard";
import Navbar from "@/components/Navbar";

export default function PublicProfile() {
  const params = useParams();
  const username = params.username as string;

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getPublicProfile(username)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center px-4 pt-32">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Profile not found</h1>
            <p className="text-gray-500 mb-6">This profile doesn&apos;t exist or has been removed.</p>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 px-5 py-2.5 rounded-xl transition-colors">
              Go to Stamp
            </a>
          </div>
        </div>
      </div>
    );
  }

  const profile = data.profile as Record<string, unknown>;
  const employment = (data.employment || []) as Record<string, unknown>[];
  const education = (data.education || []) as Record<string, unknown>[];
  const verifiedCount = (data.verified_count || 0) as number;
  const totalCount = (data.total_count || employment.length + education.length) as number;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header card */}
        <div className="animate-fade-in bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-10">
          <div className="h-24 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900" />
          <div className="px-8 pb-8 -mt-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold ring-4 ring-white shadow-lg overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url as string} alt={profile.full_name as string} className="w-16 h-16 rounded-2xl object-cover" />
                  ) : (
                    (profile.full_name as string).charAt(0).toUpperCase()
                  )}
                </div>
                <div className="mb-0.5">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">{profile.full_name as string}</h1>
                    {verifiedCount > 0 && (
                      <svg className="w-5 h-5 text-blue-600 verified-glow" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {profile.headline ? <p className="text-gray-500">{profile.headline as string}</p> : null}
                  {profile.location ? (
                    <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                      {profile.location as string}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-3">
                <svg viewBox="0 0 24 24" fill="#3B82F6" className="w-6 h-6 verified-glow"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                <div>
                  <p className="text-lg font-bold text-blue-700">{verifiedCount} <span className="text-sm font-medium text-blue-500">of {totalCount}</span></p>
                  <p className="text-xs font-medium text-blue-500">verified</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              <span className="text-gray-400"><strong className="text-gray-900 font-semibold">{totalCount}</strong> claims</span>
              <span className="text-gray-400"><strong className="text-blue-600 font-semibold">{verifiedCount}</strong> verified</span>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="sm:ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                {copied ? "Copied!" : "Share profile"}
              </button>
            </div>
            {verifiedCount > 0 && (
              <p className="mt-3 text-xs text-gray-400">Each verified claim was checked directly by the employer or university.</p>
            )}
          </div>
        </div>

        {/* Employment */}
        {employment.length > 0 && (
          <section className="animate-fade-in mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Employment</h2>
            </div>
            <div className="space-y-3">{employment.map((c) => <EmploymentCard key={c.id as string} claim={c as never} />)}</div>
          </section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <section className="animate-fade-in mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Education</h2>
            </div>
            <div className="space-y-3">{education.map((c) => <EducationCard key={c.id as string} claim={c as never} />)}</div>
          </section>
        )}

        {employment.length === 0 && education.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium mb-1">No verified claims yet</p>
            <p className="text-sm text-gray-400">This profile is waiting for confirmation from the source.</p>
          </div>
        )}
      </div>

      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-400">
            <a href="/" className="inline-flex items-center gap-1.5 font-semibold text-gray-600 hover:text-gray-900 transition-colors">
              <img src="/logo-sm.png" alt="" className="w-4 h-4" />
              Verified on Stamp
            </a>
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a href="/jobs" className="hover:text-gray-600 transition-colors">Browse Jobs</a>
            <a href="/companies" className="hover:text-gray-600 transition-colors">Companies</a>
            <a href="/?auth=signup" className="hover:text-gray-600 transition-colors">Get Started</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

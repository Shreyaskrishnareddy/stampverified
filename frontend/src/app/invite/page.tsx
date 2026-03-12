"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

function InviteContent() {
  const searchParams = useSearchParams();
  const companyName = searchParams.get("company") || "your organization";
  const companyDomain = searchParams.get("domain") || "";

  return (
    <div className="max-w-xl mx-auto px-6 py-20">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="bg-[#0A0A0A] px-8 py-8 text-center">
          <span className="text-white font-bold text-2xl">Stamp</span>
          <p className="text-gray-400 mt-2">Verified professional profiles</p>
        </div>

        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Join Stamp to verify {companyName} employees
          </h1>
          <p className="text-gray-500 leading-relaxed mb-8">
            Someone from {companyName} wants to get their employment verified. Register your organization on Stamp to verify their claims and build employer trust.
          </p>

          {companyDomain && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-8">
              <p className="text-sm text-gray-500">Organization domain</p>
              <p className="text-lg font-semibold text-gray-900">{companyDomain}</p>
            </div>
          )}

          <Link
            href="/for-employers"
            className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all shadow-lg"
          >
            Register {companyName}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </Link>

          <p className="text-xs text-gray-400 mt-6">
            Free for all organizations. Takes 2 minutes to set up.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <Suspense fallback={<div className="flex justify-center pt-32"><div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>}>
        <InviteContent />
      </Suspense>
    </div>
  );
}

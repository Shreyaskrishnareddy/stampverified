"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function InviteCodePage() {
  const params = useParams();
  const code = params.code as string;

  const [companyName, setCompanyName] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.decodeInvite(code)
      .then((data) => {
        setCompanyName(data.company);
        setCompanyDomain(data.domain);
        setInviterName(data.from);
      })
      .catch(() => setError("This invite link is invalid or expired."))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <Navbar />
        <div className="flex items-center justify-center px-4 pt-32">
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Invalid invite</h1>
            <p className="text-gray-500 mb-6">{error}</p>
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 px-5 py-2.5 rounded-xl transition-colors">
              Go to Stamp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-20">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden animate-fade-in">
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
              {inviterName} from {companyName} wants to get their employment verified. Register your organization on Stamp to verify their claims and build employer trust.
            </p>

            {companyDomain && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-8">
                <p className="text-sm text-gray-500">Organization domain</p>
                <p className="text-lg font-semibold text-gray-900">{companyDomain}</p>
              </div>
            )}

            <Link
              href={`/for-employers/register?company=${encodeURIComponent(companyName)}&domain=${encodeURIComponent(companyDomain)}`}
              className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all shadow-lg"
            >
              Register {companyName}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>

            <p className="text-xs text-gray-400 mt-6">
              Free for all organizations. Takes 2 minutes to set up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

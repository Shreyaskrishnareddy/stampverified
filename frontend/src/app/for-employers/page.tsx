"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function ForEmployersPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-20 pb-32 px-6">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-blue-50/50 to-transparent rounded-full blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-2 text-[13px] font-semibold text-blue-700 mb-8">
            For Employers & Institutions
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 leading-[1.1]">
            Become a verified employer.<br />Protect your brand.
          </h1>
          <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            People claim they worked at your company. Now you control which claims are true. Verify, correct, or dispute — directly from your dashboard. Free forever.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/for-employers/register"
              className="bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all shadow-2xl shadow-gray-900/25 hover:-translate-y-0.5"
            >
              Register your organization
            </Link>
            <Link
              href="/for-employers/login"
              className="text-[15px] font-semibold text-gray-600 hover:text-gray-900 transition-colors px-6 py-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-16">How it works for employers</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", title: "Register", desc: "Sign up with your work email. Add your company name, domain, and a role-based verifier email (e.g. hr@). Takes 2 minutes.", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
              { n: "2", title: "Review claims", desc: "Employees who list your company show up in your dashboard. See their claimed title, dates, and department.", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" },
              { n: "3", title: "Take action", desc: "Verify accurate claims, propose corrections for mistakes, or dispute false ones. Protect candidates from fake postings.", icon: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
            ].map((item) => (
              <div key={item.n} className="bg-white rounded-2xl p-8 border border-gray-200">
                <div className="w-12 h-12 rounded-full bg-[#0A0A0A] flex items-center justify-center text-white text-sm font-bold mb-6">
                  {item.n}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Ready to start verifying?</h2>
        <p className="text-gray-500 mb-8">Takes 2 minutes. Free for all organizations.</p>
        <Link
          href="/for-employers/register"
          className="inline-block bg-[#0A0A0A] text-white px-8 py-4 rounded-2xl text-[15px] font-semibold hover:bg-gray-800 transition-all shadow-lg"
        >
          Register your organization
        </Link>
      </section>
    </div>
  );
}

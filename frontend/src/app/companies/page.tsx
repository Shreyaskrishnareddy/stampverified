"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Company = {
  id: string;
  name: string;
  domain: string;
  logo_url: string | null;
  website_url: string | null;
  active_job_count: number;
  verified_employee_count: number;
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search.length >= 2) params.q = search;
    api.listCompanies(params)
      .then(setCompanies)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-1">Every company on Stamp is real and registered.</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setLoading(true); }}
            placeholder="Search companies..."
            className="w-full px-4 py-2.5 pl-10 bg-white border border-gray-200 rounded-xl text-sm"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>

        {loading ? (
          <div className="flex items-center justify-center pt-16">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">No companies found</p>
            <p className="text-sm text-gray-400">
              {search ? "Try a different search." : "Companies appear here when they register on Stamp."}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {companies.map(company => (
              <Link
                key={company.id}
                href={`/companies/${company.domain}`}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {(company.logo_url || company.domain) ? (
                      <img
                        src={company.logo_url || `https://www.google.com/s2/favicons?sz=128&domain=${company.domain}`}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-lg font-bold text-gray-400">{company.name[0]}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
                      <svg viewBox="0 0 24 24" fill="#C8A235" className="w-4 h-4 flex-shrink-0"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{company.domain}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {company.active_job_count > 0 && (
                        <span className="text-blue-600 font-medium">{company.active_job_count} open role{company.active_job_count !== 1 ? "s" : ""}</span>
                      )}
                      {company.verified_employee_count > 0 && (
                        <span>{company.verified_employee_count} confirmed</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

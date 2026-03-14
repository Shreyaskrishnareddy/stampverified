"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

type Application = Record<string, unknown>;

function formatSalary(min: number, max: number, currency: string) {
  const sym = currency === "USD" ? "$" : currency + " ";
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  return `${sym}${fmt(min)}–${fmt(max)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  applied: { label: "Applied", dot: "bg-gray-300", text: "text-gray-500" },
  shortlisted: { label: "Shortlisted", dot: "bg-emerald-500", text: "text-emerald-700" },
  rejected: { label: "Not selected", dot: "bg-transparent", text: "text-gray-400" },
  withdrawn: { label: "Withdrawn", dot: "bg-transparent", text: "text-gray-300 line-through" },
};

export default function MyApplicationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const loadData = useCallback(async (accessToken: string) => {
    try {
      const apps = await api.getMyApplications(accessToken);
      setApplications(apps);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/?auth=signin"); return; }
      setToken(session.access_token);
      loadData(session.access_token);
    });
  }, [router, loadData, supabase.auth]);

  const handleWithdraw = async (appId: string) => {
    if (!token) return;
    if (!confirm("Withdraw this application?")) return;
    try {
      await api.withdrawApplication(token, appId);
      loadData(token);
    } catch { /* empty */ }
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

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
            <p className="text-sm text-gray-500 mt-1">{applications.length} application{applications.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-gray-500 hover:text-gray-900">Dashboard</Link>
            <Link href="/jobs" className="text-sm font-medium text-white bg-[#0A0A0A] px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">Browse Jobs</Link>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <p className="text-gray-600 font-medium mb-1">No applications yet</p>
            <p className="text-sm text-gray-400">
              <Link href="/jobs" className="text-gray-700 font-medium hover:text-gray-900">Browse jobs</Link> and apply with your Stamp profile.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => {
              const status = STATUS_CONFIG[app.status as string] || STATUS_CONFIG.applied;
              return (
                <div key={app.id as string} className="bg-white rounded-2xl border border-gray-200 p-6">
                  <div className="flex items-start gap-4">
                    {/* Company logo */}
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {(app.org_logo_url || app.org_domain) ? (
                        <img
                          src={(app.org_logo_url as string) || `https://www.google.com/s2/favicons?sz=128&domain=${app.org_domain}`}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">{(app.org_name as string)?.[0]}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link href={`/jobs/${app.job_id}`} className="font-semibold text-gray-900 hover:text-gray-700 truncate">
                          {app.job_title as string}
                        </Link>
                      </div>
                      <p className="text-sm text-gray-500">
                        {app.org_name as string}
                        {app.salary_min ? ` · ${formatSalary(app.salary_min as number, app.salary_max as number, app.salary_currency as string)}` : ""}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                        {typeof app.applied_at === "string" && (
                          <span className="text-xs text-gray-400">Applied {timeAgo(app.applied_at)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(app.status === "applied" || app.status === "shortlisted") && (
                        <Link
                          href="/dashboard/messages"
                          className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          Message
                        </Link>
                      )}
                      {app.status === "applied" && (
                        <button
                          onClick={() => handleWithdraw(app.id as string)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

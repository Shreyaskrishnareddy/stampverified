"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";

export default function EmployerSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [orgName, setOrgName] = useState("");
  const [verifierEmail, setVerifierEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // DNS verification
  const [dnsToken, setDnsToken] = useState("");
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsStarting, setDnsStarting] = useState(false);
  const [dnsResult, setDnsResult] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState("");

  const addToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/for-employers/login");
        return;
      }
      try {
        const orgData = await api.getMyOrganization(data.session.access_token);
        setOrg(orgData);
        setOrgName(orgData.name || "");
        setVerifierEmail(orgData.verifier_email || "");
        setLogoUrl(orgData.logo_url || "");
        if (orgData.dns_verification_token) {
          setDnsToken(orgData.dns_verification_token);
        }
      } catch {
        router.push("/for-employers/register");
        return;
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const t = await getToken();
      if (!t) return;
      const updated = await api.updateMyOrganization(t, {
        name: orgName,
        verifier_email: verifierEmail || undefined,
        logo_url: logoUrl || undefined,
      });
      setOrg(updated);
      addToast("Settings saved.");
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      addToast("Password must be at least 8 characters.", "error");
      return;
    }
    setChangingPassword(true);
    try {
      const t = await getToken();
      if (!t) return;
      await api.changePassword(t, currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword("");
      addToast("Password updated.");
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setChangingPassword(false);
  };

  const handleStartDns = async () => {
    setDnsStarting(true);
    try {
      const t = await getToken();
      if (!t) return;
      const result = await api.startDnsVerification(t);
      if (result.txt_record) {
        setDnsToken(result.txt_record.replace("stamp-verify=", ""));
      }
      setDnsResult(result);
      if (result.is_domain_verified) {
        setOrg(prev => prev ? { ...prev, is_domain_verified: true } : prev);
        addToast("Domain is already verified!");
      }
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setDnsStarting(false);
  };

  const handleCheckDns = async () => {
    setDnsChecking(true);
    setDnsResult(null);
    try {
      const t = await getToken();
      if (!t) return;
      const result = await api.checkDnsVerification(t);
      setDnsResult(result);
      if (result.is_domain_verified) {
        setOrg(prev => prev ? { ...prev, is_domain_verified: true } : prev);
        addToast("Domain verified successfully!");
      }
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setDnsChecking(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const isVerified = org?.is_domain_verified === true;
  const domain = org?.domain as string || "";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
            <p className="text-sm text-gray-500 mt-1">{domain}</p>
          </div>
          <button
            onClick={() => router.push("/employer/dashboard")}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Back to dashboard
          </button>
        </div>

        {/* Domain Verification */}
        <div className={`rounded-2xl border p-8 mb-6 animate-fade-in ${isVerified ? "bg-white border-emerald-200" : "bg-gradient-to-br from-blue-50 to-white border-blue-200"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVerified ? "bg-emerald-100" : "bg-blue-100"}`}>
              {isVerified ? (
                <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">
                {isVerified ? "Domain verified" : "Verify your domain"}
              </h2>
              {isVerified ? (
                <p className="text-sm text-emerald-700 mt-1">
                  {domain} is verified. Your company has full access to Stamp&apos;s trust features.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mt-1">
                    Prove ownership of <strong>{domain}</strong> to unlock trusted actions on Stamp.
                  </p>

                  {/* What it unlocks */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      "Post Stamp Verified jobs",
                      "Verify candidate claims",
                      "Contact verified candidates",
                      "Verified company badge",
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                        <span className="text-xs text-gray-600">{item}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-400 mt-3">
                    This is not required for basic onboarding. You can still set up your workspace, invite teammates, and prepare job drafts without verification.
                  </p>

                  {/* DNS Instructions */}
                  {dnsToken ? (
                    <div className="mt-5 space-y-3">
                      <p className="text-xs font-semibold text-gray-700">Add this DNS TXT record to {domain}:</p>
                      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Type</p>
                            <p className="text-sm font-mono text-gray-900 mt-0.5">TXT</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Host / Name</p>
                            <p className="text-sm font-mono text-gray-900 mt-0.5">@</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard("@", "host")}
                            className="text-xs text-gray-400 hover:text-gray-600 ml-3 shrink-0"
                          >
                            {copied === "host" ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Value</p>
                            <p className="text-sm font-mono text-gray-900 mt-0.5 break-all">stamp-verify={dnsToken}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(`stamp-verify=${dnsToken}`, "value")}
                            className="text-xs text-gray-400 hover:text-gray-600 ml-3 shrink-0"
                          >
                            {copied === "value" ? "Copied" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {dnsResult && !dnsResult.is_domain_verified && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                          <p className="text-xs text-amber-800">
                            TXT record not found yet. DNS changes can take up to 48 hours to propagate. You can check again anytime.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={handleCheckDns}
                        disabled={dnsChecking}
                        className="bg-[#0A0A0A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                        {dnsChecking ? "Checking..." : "Check verification"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartDns}
                      disabled={dnsStarting}
                      className="mt-4 bg-[#0A0A0A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {dnsStarting ? "Generating..." : "Start domain verification"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Org Details */}
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 animate-fade-in">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Organization details</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Domain</label>
              <input
                type="text"
                value={domain}
                disabled
                className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">Domain cannot be changed after registration.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization email</label>
              <input
                type="email"
                value={verifierEmail}
                onChange={(e) => setVerifierEmail(e.target.value)}
                placeholder="hr@company.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Must be an organizational address at your domain (e.g. hr@, people@, careers@, founder@, admin@, team@)
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-1">Organization email responsibilities</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                The organization email receives one-time secure links when employees add claims for your organization.
                The recipient can confirm, suggest corrections, or dispute each claim. No account or login is needed to verify — the link is the authentication.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-6 bg-[#0A0A0A] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>

        {/* Password */}
        <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 animate-fade-in">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Change password</h2>
          <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Your current password"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          </div>
          <button
            type="submit"
            disabled={changingPassword}
            className="mt-4 bg-gray-100 text-gray-900 px-6 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {changingPassword ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-down z-50 ${toast.type === "error" ? "bg-red-600 text-white" : "bg-gray-900 text-white"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

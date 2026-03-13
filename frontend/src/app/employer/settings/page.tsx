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
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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
      } catch {
        router.push("/for-employers/register");
        return;
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const updated = await api.updateMyOrganization(data.session.access_token, {
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
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      await api.changePassword(data.session.access_token, newPassword);
      setNewPassword("");
      addToast("Password updated.");
    } catch (err: unknown) {
      addToast((err as Error).message, "error");
    }
    setChangingPassword(false);
  };

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
            <p className="text-sm text-gray-500 mt-1">{org?.domain as string}</p>
          </div>
          <button
            onClick={() => router.push("/employer/dashboard")}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Back to dashboard
          </button>
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
                value={org?.domain as string || ""}
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
                Must be a role-based address at your domain: hr@, people@, careers@, recruiting@, talent@, registrar@, admissions@, team@
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

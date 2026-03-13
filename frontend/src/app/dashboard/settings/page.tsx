"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [profile, setProfile] = useState<{ username?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      setToken(session.access_token);
      setEmail(session.user.email || "");
      try {
        const p = await api.getMyProfile(session.access_token);
        setProfile(p);
      } catch { /* empty */ }
    });
  }, [router, supabase.auth]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords don't match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!token) return;
    setLoading(true); setError(""); setMessage("");
    try {
      await api.changePassword(token, newPassword);
      setMessage("Password updated successfully!");
      setNewPassword(""); setConfirmPassword("");
    } catch (err: unknown) { setError((err as Error).message); }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      await api.deleteAccount(token);
      await supabase.auth.signOut();
      router.push("/");
    } catch (err: unknown) { setError((err as Error).message); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{email}</p>
            </div>
            {profile?.username && (
              <div>
                <p className="text-sm text-gray-500">Public profile</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-medium text-gray-900 font-mono bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    stampverified.com/{profile.username}
                  </p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://stampverified.com/${profile.username}`); setMessage("Profile link copied!"); setTimeout(() => setMessage(""), 2000); }}
                    className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-all"
                    title="Copy link"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Change password</h2>
          {message && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-4 border border-emerald-100">{message}</div>}
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
            </div>
            <button type="submit" disabled={loading} className="bg-[#0A0A0A] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50">
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>

        {/* Delete account */}
        <div className="bg-white rounded-2xl border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Delete account</h2>
          <p className="text-sm text-gray-500 mb-4">This will permanently delete your profile, all claims, and verification history. This action cannot be undone.</p>
          {!showDeleteConfirm ? (
            <button onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(""); }} className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors">
              Delete my account
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Type <span className="font-mono text-red-600">deletemyaccount</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="deletemyaccount"
                  className="w-full px-4 py-3 bg-gray-50 border border-red-200 rounded-xl text-sm"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading || deleteConfirmText !== "deletemyaccount"}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Permanently delete everything"}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function EmployerLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showWrongAccount, setShowWrongAccount] = useState(false);
  const [existingEmail, setExistingEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try {
          await api.getMyMembership(data.session.access_token);
          router.push("/employer/dashboard");
          return;
        } catch {
          // Signed in but no workspace membership
          setExistingEmail(data.session.user.email || "");
          setShowWrongAccount(true);
        }
      }
      setCheckingAuth(false);
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (data.session) {
        // Try to get membership (works for both admins and members)
        try {
          await api.getMyMembership(data.session.access_token);
          router.push("/employer/dashboard");
        } catch {
          // Signed in but no workspace — try joining by domain
          try {
            await api.joinWorkspace(data.session.access_token);
            router.push("/employer/dashboard");
          } catch {
            setError("No company workspace found for your email domain. Register your company first.");
          }
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="bg-[#0A0A0A] px-8 py-6 text-center">
            <span className="text-white font-bold text-lg">Stamp</span>
            <p className="text-gray-400 text-sm mt-1">Employer sign in</p>
          </div>
          <div className="p-8">
            {showWrongAccount ? (
              <div className="space-y-4">
                <div className="bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-xl border border-amber-200">
                  You&apos;re signed in as <strong>{existingEmail}</strong>, but no workspace is linked to this account.
                </div>
                <div className="space-y-3">
                  <Link
                    href="/for-employers/register"
                    className="block w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors text-center"
                  >
                    Register your company
                  </Link>
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setShowWrongAccount(false);
                      setExistingEmail("");
                    }}
                    className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors text-center"
                  >
                    Sign out and use a different account
                  </button>
                </div>
              </div>
            ) : (
            <>
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl mb-4 border border-emerald-100">
                {message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Your password"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
              <p className="text-center text-sm text-gray-400">
                Don&apos;t have an account?{" "}
                <Link href="/for-employers/register" className="text-gray-700 font-medium hover:text-gray-900">
                  Register
                </Link>
              </p>
              <p className="text-center text-sm">
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) { setError("Enter your email first."); return; }
                    setLoading(true); setError(""); setMessage("");
                    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/auth/callback?redirect=/employer/settings`,
                    });
                    if (resetError) setError(resetError.message);
                    else setMessage("Password reset link sent! Check your email.");
                    setLoading(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Forgot password?
                </button>
              </p>
            </form>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

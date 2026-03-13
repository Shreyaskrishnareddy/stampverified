"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Suspense } from "react";

const ROLE_PREFIXES = ["hr", "people", "careers", "recruiting", "talent", "registrar", "admissions", "team"];

function isRoleBasedEmail(email: string): boolean {
  const prefix = email.split("@")[0]?.toLowerCase();
  return ROLE_PREFIXES.includes(prefix);
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [orgName, setOrgName] = useState(searchParams.get("company") || "");
  const [orgDomain, setOrgDomain] = useState(searchParams.get("domain") || "");
  const [orgType, setOrgType] = useState("company");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [alreadySignedIn, setAlreadySignedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try {
          await api.getMyOrganization(data.session.access_token);
          router.push("/employer/dashboard");
          return;
        } catch {
          // Signed in but no org — show org-only fields
          setToken(data.session.access_token);
          setAlreadySignedIn(true);
          const sessionEmail = data.session.user.email || "";
          setEmail(sessionEmail);
          const domain = sessionEmail.split("@")[1] || "";
          if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)) {
            if (!orgDomain) setOrgDomain(domain);
          }
        }
      }
      setCheckingAuth(false);
    });
  }, []);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    // Auto-fill domain from email
    const domain = val.split("@")[1];
    if (domain && domain.includes(".")) {
      setOrgDomain(domain);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate role-based email
    if (!isRoleBasedEmail(email)) {
      setError(`Organization email must be a role-based address (${ROLE_PREFIXES.join("@, ")}@). Personal emails are not allowed.`);
      setLoading(false);
      return;
    }

    try {
      let accessToken = token;

      // If not already signed in, create account first
      if (!alreadySignedIn) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          // Try signup
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/for-employers/register` },
          });
          if (signUpError) throw signUpError;
          if (!signUpData.session) {
            setError("Check your email to confirm your account, then come back to complete registration.");
            setLoading(false);
            return;
          }
          accessToken = signUpData.session.access_token;
        } else {
          accessToken = data.session?.access_token || null;
          // Check if they already have an org
          if (accessToken) {
            try {
              await api.getMyOrganization(accessToken);
              router.push("/employer/dashboard");
              return;
            } catch {
              // Good — no org yet
            }
          }
        }
      }

      if (!accessToken) {
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      // Register the organization — email is both login and verifier email
      await api.registerOrganization(accessToken, {
        name: orgName,
        domain: orgDomain,
        org_type: orgType,
        verifier_email: email,
      });
      router.push("/employer/dashboard");
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
            <p className="text-gray-400 text-sm mt-1">Register your organization</p>
          </div>
          <div className="p-8">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="Acme Inc."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Domain</label>
                <input
                  type="text"
                  value={orgDomain}
                  onChange={(e) => setOrgDomain(e.target.value)}
                  required
                  placeholder="acme.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="company">Company</option>
                  <option value="university">University</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Organization email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  required
                  disabled={alreadySignedIn}
                  placeholder="hr@acme.com"
                  className={`w-full px-4 py-3 border border-gray-200 rounded-xl text-sm ${alreadySignedIn ? "bg-gray-100 text-gray-500" : "bg-gray-50"}`}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Must be a role-based address: {ROLE_PREFIXES.join("@, ")}@
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  This email is used to sign in and receive verification requests.
                </p>
              </div>

              {!alreadySignedIn && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">What happens after registration?</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>Any existing claims naming your company are automatically sent for verification.</li>
                  <li>New claims from employees are routed to your organization email.</li>
                  <li>You can verify, correct, or dispute each claim from your dashboard.</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? "Registering..." : "Register organization"}
              </button>
              <p className="text-center text-sm text-gray-400">
                Already registered?{" "}
                <a href="/for-employers/login" className="text-gray-700 font-medium hover:text-gray-900">
                  Sign in
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

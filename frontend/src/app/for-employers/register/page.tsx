"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Suspense } from "react";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState<"auth" | "org">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState(searchParams.get("company") || "");
  const [orgDomain, setOrgDomain] = useState(searchParams.get("domain") || "");
  const [orgType, setOrgType] = useState("company");
  const [verifierEmail, setVerifierEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Check if user is already signed in
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setToken(data.session.access_token);
        try {
          await api.getMyOrganization(data.session.access_token);
          router.push("/employer/dashboard");
          return;
        } catch {
          // No org yet — go straight to org registration
          const domain = data.session.user.email?.split("@")[1] || "";
          if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)) {
            if (!orgDomain) setOrgDomain(domain);
          }
          setStep("org");
        }
      }
      setCheckingAuth(false);
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let session;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signUpError) throw signUpError;
        if (!signUpData.session) {
          setError("Check your email to confirm your account, then come back here.");
          setLoading(false);
          return;
        }
        session = signUpData.session;
      } else {
        session = data.session;
      }
      if (session) {
        setToken(session.access_token);
        try {
          await api.getMyOrganization(session.access_token);
          router.push("/employer/dashboard");
          return;
        } catch {
          setStep("org");
          const domain = email.split("@")[1];
          if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)) {
            if (!orgDomain) setOrgDomain(domain);
          }
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const handleRegisterOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      await api.registerOrganization(token, {
        name: orgName,
        domain: orgDomain,
        org_type: orgType,
        verifier_email: verifierEmail || undefined,
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
            <p className="text-gray-400 text-sm mt-1">
              {step === "auth" ? "Sign in or create account" : "Register your organization"}
            </p>
          </div>
          <div className="p-8">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}

            {step === "auth" ? (
              <form onSubmit={handleAuth} className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">Use your work email to register or sign in.</p>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work email</label>
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
                    placeholder="Min 8 characters"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Please wait..." : "Continue"}
                </button>
                <p className="text-center text-sm text-gray-400">
                  Already registered?{" "}
                  <a href="/for-employers/login" className="text-gray-700 font-medium hover:text-gray-900">
                    Sign in
                  </a>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegisterOrg} className="space-y-4">
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
                  <p className="text-xs text-gray-400 mt-1">Must match your email domain</p>
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

                <hr className="border-gray-100" />
                <p className="text-xs text-gray-500 font-medium">Verification email</p>
                <p className="text-xs text-gray-400 -mt-2">
                  This is the email where verification requests are sent. It must be a role-based address at your domain to prevent personal emails from being used for verification.
                </p>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Verifier email</label>
                  <input
                    type="email"
                    value={verifierEmail}
                    onChange={(e) => setVerifierEmail(e.target.value)}
                    required
                    placeholder="hr@acme.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Accepted: hr@, people@, careers@, recruiting@, talent@, registrar@, admissions@, team@
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-1">What happens after registration?</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>Any existing claims naming your company are automatically sent for verification.</li>
                    <li>New claims from employees are routed to your verifier email.</li>
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
              </form>
            )}
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

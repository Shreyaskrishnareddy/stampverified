"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import Navbar from "@/components/Navbar";
import CompanyAutocomplete from "@/components/CompanyAutocomplete";
import { Suspense } from "react";

const ROLE_PREFIXES = ["hr", "people", "careers", "recruiting", "talent", "registrar", "admissions", "team"];

function isRoleBasedEmail(email: string): boolean {
  const prefix = email.split("@")[0]?.toLowerCase().replace(/[.\-_]/g, "");
  return ROLE_PREFIXES.includes(prefix);
}

type Step = "company" | "email" | "register" | "join";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Step tracking
  const [step, setStep] = useState<Step>("company");

  // Company selection
  const [companyName, setCompanyName] = useState(searchParams.get("company") || "");
  const [companyDomain, setCompanyDomain] = useState(searchParams.get("domain") || "");
  const [existingOrg, setExistingOrg] = useState<{ id: string; name: string; domain: string } | null>(null);

  // Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgType, setOrgType] = useState("company");
  const [verifierEmail, setVerifierEmail] = useState("");

  // State
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [alreadySignedIn, setAlreadySignedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        // Check if already in a workspace
        try {
          await api.getMyMembership(data.session.access_token);
          router.push("/employer/dashboard");
          return;
        } catch {
          // Signed in but no workspace — continue with registration
          setToken(data.session.access_token);
          setAlreadySignedIn(true);
          const sessionEmail = data.session.user.email || "";
          setEmail(sessionEmail);
          const domain = sessionEmail.split("@")[1] || "";
          if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(domain)) {
            if (!companyDomain) setCompanyDomain(domain);
          }
        }
      }
      setCheckingAuth(false);
    });
  }, []);

  const handleCompanySelect = async (name: string, domain: string) => {
    setCompanyName(name);
    setCompanyDomain(domain);
    setError("");

    // Check if this company is already registered on Stamp
    try {
      const results = await api.searchOrganizations(name);
      const match = (results as { domain: string; id: string; name: string }[]).find(
        (org: { domain: string }) => org.domain === domain
      );
      if (match) {
        setExistingOrg(match);
        setStep("join");
        return;
      }
    } catch { /* not found, continue to register */ }

    setExistingOrg(null);
    // If already signed in, skip email step (we already have their email)
    setStep(alreadySignedIn ? "register" : "email");
  };

  const handleEmailContinue = () => {
    if (!email.trim()) { setError("Enter your company email"); return; }

    const emailDomain = email.split("@")[1];
    if (emailDomain !== companyDomain) {
      setError(`Your email domain must match ${companyDomain}`);
      return;
    }

    setError("");
    setStep("register");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate verifier email is role-based
    const finalVerifier = verifierEmail || email;
    if (!isRoleBasedEmail(finalVerifier)) {
      setError(`Verification email must be a role-based address (${ROLE_PREFIXES.join("@, ")}@). This is the email that receives verification requests.`);
      setLoading(false);
      return;
    }

    try {
      let accessToken = token;

      // Create account if not already signed in
      if (!alreadySignedIn) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
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
        }
      }

      if (!accessToken) {
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      // Register the organization
      await api.registerOrganization(accessToken, {
        name: companyName,
        domain: companyDomain,
        org_type: orgType,
        verifier_email: finalVerifier,
      });

      router.push("/employer/dashboard");
    } catch (err: unknown) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let accessToken = token;

      // Create account if not already signed in
      if (!alreadySignedIn) {
        if (!email.trim() || !password.trim()) {
          setError("Enter your email and password");
          setLoading(false);
          return;
        }

        const emailDomain = email.split("@")[1];
        if (emailDomain !== companyDomain) {
          setError(`Your email domain must match ${companyDomain}`);
          setLoading(false);
          return;
        }

        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/for-employers/register` },
          });
          if (signUpError) throw signUpError;
          if (!signUpData.session) {
            setError("Check your email to confirm your account, then come back.");
            setLoading(false);
            return;
          }
          accessToken = signUpData.session.access_token;
        } else {
          accessToken = data.session?.access_token || null;
        }
      }

      if (!accessToken) {
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      // Join the workspace
      await api.joinWorkspace(accessToken);
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
              {step === "join" ? `Join ${existingOrg?.name || "workspace"}` : "Register your company"}
            </p>
          </div>

          <div className="p-8">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4 border border-red-100">
                {error}
              </div>
            )}

            {/* Step 1: Select company */}
            {step === "company" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Find your company</label>
                  <CompanyAutocomplete
                    value={companyName}
                    domain={companyDomain}
                    onChange={(name: string, domain: string) => handleCompanySelect(name, domain)}
                  />
                  <p className="text-xs text-gray-400 mt-2">Select your company from the dropdown to continue.</p>
                </div>
                <p className="text-center text-sm text-gray-400">
                  Already registered?{" "}
                  <a href="/for-employers/login" className="text-gray-700 font-medium hover:text-gray-900">Sign in</a>
                </p>
              </div>
            )}

            {/* Step: Join existing workspace */}
            {step === "join" && (
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-emerald-800">{existingOrg?.name} is on Stamp</p>
                  <p className="text-emerald-700 mt-1">Sign up with your @{companyDomain} email to join the workspace.</p>
                </div>

                {!alreadySignedIn && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your company email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder={`you@${companyDomain}`}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Min 8 characters"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Joining..." : `Join ${existingOrg?.name}`}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("company"); setExistingOrg(null); setError(""); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600"
                >
                  Choose a different company
                </button>
              </form>
            )}

            {/* Step: Enter email (new company) */}
            {step === "email" && !alreadySignedIn && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-gray-600">
                  Registering <strong>{companyName}</strong> ({companyDomain})
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your company email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder={`you@${companyDomain}`}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">Must be an @{companyDomain} address</p>
                </div>
                <button
                  onClick={handleEmailContinue}
                  className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("company"); setError(""); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600"
                >
                  Choose a different company
                </button>
              </div>
            )}

            {/* If already signed in and new company, auto-advance past email step */}

            {/* Step: Full registration form (new company) */}
            {step === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm text-gray-600">
                  Registering <strong>{companyName}</strong> ({companyDomain}) as <strong>{email}</strong>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
                  <select
                    value={orgType}
                    onChange={e => setOrgType(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  >
                    <option value="company">Company</option>
                    <option value="university">University</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Verification email</label>
                  <input
                    type="email"
                    value={verifierEmail}
                    onChange={e => setVerifierEmail(e.target.value)}
                    placeholder={`hr@${companyDomain}`}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Role-based address that receives claim verification requests ({ROLE_PREFIXES.slice(0, 4).join("@, ")}@). Defaults to your email if left empty.
                  </p>
                </div>

                {!alreadySignedIn && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-800 mb-1">What happens next?</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>You become the workspace admin with full control.</li>
                    <li>Any existing claims for your company are sent for verification.</li>
                    <li>Team members can join by signing up with an @{companyDomain} email.</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A0A0A] text-white py-3 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {loading ? "Registering..." : "Register company"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("company"); setError(""); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600"
                >
                  Start over
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

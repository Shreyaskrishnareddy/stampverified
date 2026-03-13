"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";

export default function Navbar() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        setUser({ email: data.session.user.email || "" });
        try {
          await api.getMyOrganization(data.session.access_token);
          setIsOrgAdmin(true);
        } catch {
          setIsOrgAdmin(false);
        }
      }
    });
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsOrgAdmin(false);
    router.push("/");
  };

  const isEmployerRoute = pathname.startsWith("/employer") || pathname.startsWith("/for-employers");

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-[#0A0A0A]">Stamp</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {!isEmployerRoute && !isOrgAdmin && (
            <Link
              href="/for-employers"
              className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              For Employers
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  {user.email[0]?.toUpperCase()}
                </button>
                {showDropdown && (
                  <>
                    <div className="fixed inset-0" onClick={() => setShowDropdown(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 animate-slide-down">
                      {isOrgAdmin ? (
                        <>
                          <Link href="/employer/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                            Employer Dashboard
                          </Link>
                          <Link href="/employer/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                            Organization Settings
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                            Dashboard
                          </Link>
                          <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                            Settings
                          </Link>
                        </>
                      )}
                      <hr className="my-1 border-gray-100" />
                      <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/?auth=signin"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/?auth=signup"
                className="text-sm font-medium text-white bg-[#0A0A0A] hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

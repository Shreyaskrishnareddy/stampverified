"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { api } from "@/lib/api";

export default function Navbar() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser({ email: data.session.user.email || "" });
        api.getUnreadCount(data.session.access_token).then(d => setUnreadCount(d.count)).catch(() => {});
      }
    });
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
          {!isEmployerRoute && (
            <Link
              href="/for-employers"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              For Employers
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              {/* Notification bell */}
              <button
                onClick={() => router.push("/dashboard")}
                className="relative p-1.5 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

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
                      <Link href="/dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                        Dashboard
                      </Link>
                      <Link href="/dashboard/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowDropdown(false)}>
                        Settings
                      </Link>
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

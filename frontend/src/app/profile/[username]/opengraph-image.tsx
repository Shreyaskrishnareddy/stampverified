import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  let profile: any = null;
  let verifiedCount = 0;
  let totalCount = 0;

  try {
    const res = await fetch(`${API_URL}/api/profile/${username}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      profile = data.profile;
      const allClaims = [...(data.employment || []), ...(data.education || [])];
      totalCount = allClaims.length;
      verifiedCount = allClaims.filter((c: any) => c.status === "verified").length;
    }
  } catch {}

  const name = profile?.full_name || username;
  const headline = profile?.headline || "";
  const initial = name.charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "white",
            borderRadius: 32,
            padding: "48px 64px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            maxWidth: 700,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 36,
              fontWeight: 800,
              marginBottom: 20,
            }}
          >
            {initial}
          </div>

          {/* Name + tick */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: "#0f172a" }}>{name}</span>
            {verifiedCount > 0 && (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#0ea5e9">
                <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {headline && (
            <span style={{ fontSize: 18, color: "#64748b", marginTop: 8 }}>{headline}</span>
          )}

          {/* Stats */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginTop: 28,
              paddingTop: 24,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#0ea5e9" }}>{verifiedCount}</span>
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>VERIFIED</span>
            </div>
            <div style={{ width: 1, height: 36, background: "#e2e8f0" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{totalCount}</span>
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>CLAIMS</span>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 32 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#38bdf8">
            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#94a3b8" }}>stampverified.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}

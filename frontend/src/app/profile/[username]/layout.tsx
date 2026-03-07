import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;

  let title = `${username} — Stamp`;
  let description = `View ${username}'s verified professional profile on Stamp.`;

  try {
    const res = await fetch(`${API_URL}/api/profile/${username}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const p = data.profile;
      const allClaims = [...(data.employment || []), ...(data.education || [])];
      const verified = allClaims.filter((c: any) => c.status === "verified").length;
      title = `${p.full_name} — Stamp`;
      description = p.headline
        ? `${p.headline} — ${verified} of ${allClaims.length} claims verified on Stamp.`
        : `${verified} of ${allClaims.length} claims verified on Stamp.`;
    }
  } catch {}

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Stamp",
      type: "profile",
      url: `https://stampverified.com/${username}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stamp | Your career. Verified.",
  description: "Every claim on your profile is verified by the source. No fake profiles. Just proof.",
  metadataBase: new URL("https://stampverified.com"),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Stamp | Your career. Verified.",
    description: "Every claim on your profile is verified by the source. No fake profiles. Just proof.",
    siteName: "Stamp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#FAFAFA] text-[#0A0A0A] min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

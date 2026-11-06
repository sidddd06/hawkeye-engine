import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HawkEye // CCTV Forensics & Bounty Search Engine",
  description: "Zero-Cloud 12-Hour CCTV Forensics & Multimodal Search Engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0b0f19] text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

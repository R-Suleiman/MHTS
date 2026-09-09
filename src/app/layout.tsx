import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MHTS · A little more in tune with you",
  description:
    "A space for reflecting on well-being, daily check-ins, and small steps forward.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

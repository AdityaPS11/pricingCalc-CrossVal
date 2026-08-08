"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function NavBar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <nav className="nav-bar">
      <div className="nav-brand">Ledger</div>
      <div className="nav-links">
        <Link href="/documents" className={pathname?.startsWith("/documents") ? "nav-link active" : "nav-link"}>
          Documents
        </Link>
        <Link href="/reports" className={pathname?.startsWith("/reports") ? "nav-link active" : "nav-link"}>
          Reports
        </Link>
      </div>
      <div className="nav-right">
        <span className="nav-email">{userEmail}</span>
        <button className="nav-signout" onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

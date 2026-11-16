"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "../../../lib/i18n";
import { adminMessages } from "./messages";
import styles from "../../page.module.css";

export default function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const text = adminMessages(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) { setError(text.logoutFailed); return; }
      router.replace(`/${locale}/admin/login`);
      router.refresh();
    } catch { setError(text.network); }
    finally { setPending(false); }
  }
  return <div>
    <button className={styles.action} type="button" onClick={logout} disabled={pending}>{pending ? text.loggingOut : text.logout}</button>
    {error && <p className="fieldError" role="alert">{error}</p>}
  </div>;
}

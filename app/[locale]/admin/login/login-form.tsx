"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "../../../../lib/i18n";
import { adminMessages } from "../messages";
import styles from "../../../page.module.css";

export default function LoginForm({ locale }: { locale: Locale }) {
  const text = adminMessages(locale);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      if (!response.ok) { setError(response.status === 503 ? text.unavailable : text.failed); return; }
      router.replace(`/${locale}/admin`);
      router.refresh();
    } catch { setError(text.network); }
    finally { setPending(false); }
  }

  return <form className={styles.searchForm} onSubmit={submit} aria-busy={pending} style={{ maxWidth: "30rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
    <label htmlFor="owner-email">{text.email}</label>
    <input id="owner-email" name="email" type="email" autoComplete="username" required maxLength={254} aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} />
    <label htmlFor="owner-password">{text.password}</label>
    <input id="owner-password" name="password" type="password" autoComplete="current-password" required maxLength={128} aria-invalid={error ? true : undefined} aria-describedby={error ? "login-error" : undefined} />
    {error && <p id="login-error" role="alert" className="fieldError">{error}</p>}
    <button type="submit" disabled={pending}>{pending ? text.pending : text.submit}</button>
  </form>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth, getOwnerSession } from "../../../../lib/auth";
import { isLocale } from "../../../../lib/i18n";
import { adminMessages } from "../messages";
import LoginForm from "./login-form";
import styles from "../../../page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = adminMessages(locale);
  const configured = Boolean(getAuth());
  if (configured && await getOwnerSession(await headers())) redirect(`/${locale}/admin`);
  return <>
    <section className={styles.hero} aria-labelledby="login-heading">
      <p className={styles.eyebrow}>DEID</p><h1 id="login-heading">{text.login}</h1><p className={styles.lead}>{text.private}</p>
    </section>
    {configured ? <LoginForm locale={locale} /> : <div className={styles.empty}><h2>{text.unavailable}</h2><p>{text.setup}</p></div>}
    <p><Link className={styles.action} href={`/${locale}`}>{text.home}</Link></p>
  </>;
}

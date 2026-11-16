import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getOwnerSession } from "../../../lib/auth";
import { isLocale } from "../../../lib/i18n";
import { adminMessages } from "./messages";
import LogoutButton from "./logout-button";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getOwnerSession(await headers());
  if (!session) redirect(`/${locale}/admin/login`);
  const text = adminMessages(locale);
  return <>
    <section className={styles.hero} aria-labelledby="admin-heading"><p className={styles.eyebrow}>DEID</p><h1 id="admin-heading">{text.title}</h1><p className={styles.lead}>{text.intro}</p></section>
    <div className={styles.empty}><h2>{text.empty}</h2><p>{text.emptyBody}</p></div>
    <LogoutButton locale={locale} />
  </>;
}

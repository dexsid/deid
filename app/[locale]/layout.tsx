import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dictionary, isLocale, locales } from "../../lib/i18n";
import Navigation from "./navigation";
import styles from "../page.module.css";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const text = dictionary(locale);
  return { title: { default: "Deid", template: "%s · Deid" }, description: text.lead };
}

export default async function LocaleLayout({ children, params }: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = dictionary(locale);
  return <html lang={locale}><body>
    <a className="skip" href="#main">{text.skip}</a>
    <div className={styles.shell}>
      <Suspense fallback={<header className={styles.sidebar}>Deid</header>}><Navigation locale={locale} /></Suspense>
      <main id="main" className={styles.main}>
        <div className={styles.topline}><span>{text.topline}</span><span>DEID JOURNAL</span></div>
        {children}
        <footer className={styles.footer}>{text.footer}</footer>
      </main>
    </div>
  </body></html>;
}

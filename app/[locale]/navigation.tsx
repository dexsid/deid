"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { dictionary, locales, localizedPath, sections, type Locale } from "../../lib/i18n";
import ThemePicker from "../theme-picker";
import styles from "../page.module.css";

export default function Navigation({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const text = dictionary(locale);
  const query = searchParams.toString();
  const links = <>
    <Link href={`/${locale}`} aria-current={pathname === `/${locale}` ? "page" : undefined}>{text.home}</Link>
    {sections.map((section) => <Link key={section} href={`/${locale}/${section}`} aria-current={pathname.startsWith(`/${locale}/${section}`) ? "page" : undefined}>{text[section]}</Link>)}
  </>;
  return <header className={styles.sidebar}>
    <Link className={styles.logo} href={`/${locale}`} aria-label={`Deid — ${text.home}`}>deid<span>®</span></Link>
    <p>{text.motto}</p>
    <nav className={styles.desktopNav} aria-label={text.navigation}>{links}</nav>
    <details className={styles.mobileDetails} key={pathname}><summary>{text.menu}</summary><nav aria-label={text.navigation}>{links}</nav></details>
    <form className={styles.searchForm} action={`/${locale}/publications`} method="get" role="search">
      <label htmlFor="navigation-search">{text.search}</label>
      <input id="navigation-search" type="search" name="q" placeholder={text.searchPlaceholder} maxLength={200} />
      <button type="submit">{text.searchButton}</button>
    </form>
    <nav className={styles.languageSwitcher} aria-label={text.languages}>{locales.map((target) => <Link key={target} href={`${localizedPath(pathname, target)}${query ? `?${query}` : ""}`} hrefLang={target} lang={target} aria-current={target === locale ? "true" : undefined}>{target === "kk" ? "KZ" : target.toUpperCase()}</Link>)}</nav>
    <ThemePicker locale={locale} /><small>{text.personal}</small>
  </header>;
}

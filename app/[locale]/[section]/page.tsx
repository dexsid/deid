import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dictionary, isLocale, isSection } from "../../../lib/i18n";
import styles from "../../page.module.css";

type Props = {
  params: Promise<{ locale: string; section: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, section } = await params;
  return isLocale(locale) && isSection(section) ? { title: dictionary(locale)[section] } : {};
}

export default async function SectionPage({ params, searchParams }: Props) {
  const { locale, section } = await params;
  if (!isLocale(locale) || !isSection(section)) notFound();
  const text = dictionary(locale);
  const rawQuery = (await searchParams).q;
  const query = (typeof rawQuery === "string" ? rawQuery : "").trim().slice(0, 200);
  const intro = section === "publications" ? text.emptyPublications : section === "goals" ? text.goalsIntro : section === "experiments" ? text.experimentsIntro : text.aboutIntro;
  const empty = section === "publications" ? text.emptyPublications : section === "goals" ? text.goalsEmpty : section === "experiments" ? text.experimentsEmpty : text.aboutEmpty;
  return <>
    <section className={styles.hero} aria-labelledby="heading">
      <p className={styles.eyebrow}>DEID JOURNAL</p>
      <h1 id="heading">{text[section]}</h1>
      <p className={styles.lead}>{intro}</p>
    </section>
    {section === "publications" && <form className={styles.searchForm} action={`/${locale}/publications`} method="get" role="search" aria-label={text.search}>
      <label htmlFor="archive-search">{text.search}</label>
      <input id="archive-search" type="search" name="q" defaultValue={query} placeholder={text.searchPlaceholder} maxLength={200} />
      <button type="submit">{text.searchButton}</button>
      {query && <Link href={`/${locale}/publications`}>{text.reset}</Link>}
    </form>}
    <div className={styles.empty}>
      <span aria-hidden="true">✳</span>
      {section === "publications" && query ? <><h2>{text.noResults}</h2><p>{text.queryLabel}: «{query}»</p><p>{text.noResultsBody}</p></> : <p>{empty}</p>}
    </div>
  </>;
}

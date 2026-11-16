import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleStore } from "../../../lib/articles";
import { articleMessages } from "../../../lib/article-messages";
import { dictionary, isLocale } from "../../../lib/i18n";
import ArticleCard from "./article-card";
import styles from "./articles.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[]; tag?: string | string[]; page?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: dictionary(locale).publications } : {};
}

export default async function PublicationsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const search = await searchParams;
  const q = typeof search.q === "string" ? search.q.trim().slice(0, 200) : "";
  const tag = typeof search.tag === "string" ? search.tag.trim().slice(0, 60) : "";
  const rawPage = typeof search.page === "string" && /^\d+$/.test(search.page) ? Number(search.page) : 1;
  const page = Math.min(50_000, Math.max(1, Number.isFinite(rawPage) ? rawPage : 1));
  const pageSize = 20;
  const text = dictionary(locale);
  const messages = articleMessages(locale);
  const results = await getArticleStore().listPublished(locale, { q, tag, limit: pageSize + 1, offset: (page - 1) * pageSize });
  const articles = results.slice(0, pageSize);
  const hasNext = results.length > pageSize && page < 50_000;
  function pageHref(target: number) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (tag) query.set("tag", tag);
    query.set("page", String(target));
    return `/${locale}/publications?${query}`;
  }
  return <>
    <header className={styles.heading}><h1>{text.publications}</h1><p className={styles.intro}>{messages.intro}</p></header>
    <form className={styles.filters} action={`/${locale}/publications`} method="get" role="search" aria-label={text.search}>
      <label className={styles.field} htmlFor="archive-search">{text.search}<input id="archive-search" type="search" name="q" defaultValue={q} maxLength={200} placeholder={text.searchPlaceholder} /></label>
      <label className={styles.field} htmlFor="archive-tag">{messages.tag}<input id="archive-tag" name="tag" defaultValue={tag} maxLength={60} placeholder={messages.allTags} /></label>
      <button type="submit">{text.searchButton}</button>
      {(q || tag) && <Link className={styles.reset} href={`/${locale}/publications`}>{q ? text.reset : messages.reset}</Link>}
    </form>
    {articles.length ? <><p className={styles.count}>{messages.count}: {articles.length}</p><div className={styles.grid}>{articles.map((article) => <ArticleCard key={article.id} article={article} locale={locale} />)}</div></> : <div className={styles.empty}>
      <h2>{q || tag || page > 1 ? text.noResults : text.emptyTitle}</h2>
      {q && <p>{text.queryLabel}: «{q}»</p>}
      <p>{q || tag || page > 1 ? text.noResultsBody : text.emptyPublications}</p>
    </div>}
    {(page > 1 || hasNext) && <nav className={styles.pagination} aria-label={messages.pagination}>
      {page > 1 && <Link href={pageHref(page - 1)} rel="prev">← {messages.previous}</Link>}
      <span>{messages.page} {page}</span>
      {hasNext && <Link href={pageHref(page + 1)} rel="next">{messages.next} →</Link>}
    </nav>}
  </>;
}

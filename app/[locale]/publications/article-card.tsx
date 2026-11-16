import Link from "next/link";
import type { PublishedArticle } from "../../../lib/articles";
import { articleLanguages, articleMessages } from "../../../lib/article-messages";
import type { Locale } from "../../../lib/i18n";
import styles from "./articles.module.css";

type Article = PublishedArticle;

export function ArticleTags({ tags, locale }: { tags: string[]; locale: Locale }) {
  return tags.length ? <ul className={styles.tags} aria-label={articleMessages(locale).tags}>{tags.map((tag) => <li key={tag}><Link href={`/${locale}/publications?${new URLSearchParams({ tag })}`}>{tag}</Link></li>)}</ul> : null;
}

export function OriginalNotice({ article, locale }: { article: Article; locale: Locale }) {
  return article.isFallback ? <p className={styles.fallback} lang={locale}>{articleMessages(locale).original} <span lang={article.locale}>{articleLanguages[article.locale]}</span></p> : null;
}

export function PublishedDate({ value, locale }: { value: number; locale: Locale }) {
  return <time dateTime={new Date(value).toISOString()}>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(value)}</time>;
}

export default function ArticleCard({ article, locale, related = false }: { article: Article; locale: Locale; related?: boolean }) {
  const Heading = related ? "h3" : "h2";
  return <article className={styles.card} lang={article.locale}>
    <p className={styles.meta} lang={locale}><PublishedDate value={article.publishedAt} locale={locale} /></p>
    <Heading><Link href={`/${locale}/publications/${encodeURIComponent(article.slug)}`}>{article.title}</Link></Heading>
    <OriginalNotice article={article} locale={locale} />
    {article.summary && <p>{article.summary}</p>}
    <ArticleTags tags={article.tags} locale={locale} />
  </article>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleStore } from "../../../../lib/articles";
import { articleMessages } from "../../../../lib/article-messages";
import { isLocale } from "../../../../lib/i18n";
import ArticleCard, { ArticleTags, OriginalNotice, PublishedDate } from "../article-card";
import styles from "../articles.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const article = await getArticleStore().getPublished(slug, locale);
  return article ? { title: article.title, description: article.summary || undefined } : {};
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const store = getArticleStore();
  const article = await store.getPublished(slug, locale);
  if (!article) notFound();
  const related = await store.recommendations(slug, locale, 3);
  const text = articleMessages(locale);
  return <>
    <article className={styles.article} lang={article.locale}>
      <Link className={styles.back} href={`/${locale}/publications`} lang={locale}>‚Üê {text.back}</Link>
      <header className={styles.heading}>
        <p className={styles.meta} lang={locale}>{text.published} ¬∑ <Publisnı÷⁄$z{-ÆÈ‹j◊ù&V∆FVBÚ&É2"¢&É"#∞¢&WGW&‚∆'Fñ6∆R6∆74Ê÷S◊∑7Gñ∆W2Ê6&G“∆Ês◊∂'Fñ6∆RÊ∆ˆ6∆W”‡¢«6∆74Ê÷S◊∑7Gñ∆W2Ê÷WF“∆Ês◊∂∆ˆ6∆W”„≈V&∆ó6ÜVDFFRf«VS◊∂'Fñ6∆RÁV&∆ó6ÜVDG“∆ˆ6∆S◊∂∆ˆ6∆W“Û„¬˜‡¢ƒÜVFñÊs„ƒ∆ñÊ≤á&Vc◊∂ÚG∂∆ˆ6∆W“˜V&∆ñ6FñˆÁ2ÚG∂VÊ6ˆFUU$î6ˆ◊ˆÊVÁBÜ'Fñ6∆RÁ6«Vró÷”Á∂'Fñ6∆RÁFóF∆W”¬Ù∆ñÊ≥„¬ÙÜVFñÊs‡¢ƒ˜&ñvñÊƒÊ˜Fñ6R'Fñ6∆S◊∂'Fñ6∆W“∆ˆ6∆S◊∂∆ˆ6∆W“Û‡¢∂'Fñ6∆RÁ7V÷÷'íbb«Á∂'Fñ6∆RÁ7V÷÷'ó”¬˜Á–¢ƒ'Fñ6∆UFw2Fw3◊∂'Fñ6∆RÁFw7“∆ˆ6∆S◊∂∆ˆ6∆W“Û‡¢¬ˆ'Fñ6∆S„∞ß–
import Link from "next/link";
import { notFound } from "next/navigation";
import { dictionary, isLocale } from "../../lib/i18n";
import styles from "../page.module.css";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const text = dictionary(locale);
  return <>
    <section className={styles.hero} aria-labelledby="heading">
      <p className={styles.eyebrow}>{text.eyebrow}</p>
      <h1 id="heading">{text.hero}<br /><em>{text.heroAccent}</em></h1>
      <p className={styles.lead}>{text.lead}</p>
      <Link className={styles.action} href={`/${locale}/publications`}>{text.explore} <span aria-hidden="true">↗</span></Link>
    </section>
    <section id="publications" className={styles.publications} aria-labelledby="publications-title">
      <div className={styles.sectionHeading}><h2 id="publications-title">{text.publications}</h2><span>{text.journal}</span></div>
      <div className={styles.empty}><span aria-hidden="true">✳</span><h3>{text.emptyTitle}</h3><p>{text.emptyPublications}</p></div>
    </section>
  </>;
}

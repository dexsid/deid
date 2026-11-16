import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../lib/db';
import { createArticleStore } from '../lib/articles';

const content = { title: 'ะ—ะฐะผะตัะบะธ ะพะฑ ะพะฑััะตะฝะธะธ', summary: 'ะะพั€ะพัะบะพะต ั€ะตะทัะผะต', body: 'ำะปะตะผ ััั€ะฐะปั ะฑั–ะปั–ะผ. ะัะฑะปะธัะฝัะน ัะตะบัั.', tags: ['ะะฑััะตะฝะธะต', 'ำะดะตั'] };

describe('published article boundaries', () => {
  let directory: string;
  let database: ReturnType<typeof openDatabase>;
  let store: ReturnType<typeof createArticleStore>;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'deid-articles-test-'));
    database = openDatabase(join(directory, 'articles.sqlite'));
    store = createArticleStore(database);
  });
  afterEach(() => {
    database?.close();
    rmSync(directory, { recursive: true, force: true });
  });

  function published(slug: string, tags = content.tags) {
    const article = store.create({ slug, originalLocale: 'ru' });
    store.saveDraft(article.id, 'ru', { ...content, tags });
    store.publish(article.id, 'ru');
    return article;
  }

  it('keeps drafts out of every public query', () => {
    const article = store.create({ slug: 'private-draft', originalLocale: 'ru' });
    store.saveDraft(article.id, 'ru', content);
    expect(store.getDraft(article.id, 'ru')).toMatchObject(content);
    expect(store.getPublished(article.slug, 'ru')).toBeNull();
    expect(store.listPublished('ru')).toEqual([]);
    expect(store.listPublished('ru', { q: 'ำะะ•ะ' })).toEqual([]);
    expect(store.listPublished('ru', { tag: 'ำะดะตั' })).toEqual([]);
    expect(store.recommendations(article.slug, 'ru')).toEqual([]);
  });

  it('preserves the complete published snapshot while editing a draft', () => {
    const article = published('snapshot');
    const before = store.getPublished(article.slug, 'ru');
    store.saveDraft(article.id, 'ru', { title: 'ะกะตะบั€ะตัะฝัะน ะทะฐะณะพะปะพะฒะพะบ', summary: 'ะกะตะบั€ะตัะฝะพะต ั€ะตะทัะผะต', body: 'ะกะตะบั€ะตัะฝัะน ัะตะบัั', tags: ['ะั€ะธะฒะฐัะฝะพะต'] });
    expect(store.getPublished(article.slug, 'ru')).toEqual(before);
    expect(store.listPublished('ru', { q: 'ะกะตะบั€ะตัะฝัะน' })).toEqual([]);
    expect(store.listPublished('ru', { tag: 'ะั€ะธะฒะฐัะฝะพะต' })).toEqual([]);
    store.publish(article.id, 'ru');
    expect(store.getPublished(article.slug, 'ru')).toMatchObject({ title: 'ะกะตะบั€ะตัะฝัะน ะทะฐะณะพะปะพะฒะพะบ', tags: ['ะั€ะธะฒะฐัะฝะพะต'] });
  });

  it('uses published translation and otherwise the published original with language metadata', () => {
    const article = published('translations');
    store.saveDraft(article.id, 'en', { ...content, title: 'Unpublished translation' });
    expect(store.getPublished(article.slug, 'en')).toMatchObject({ locale: 'ru', originalLocale: 'ru', isFallback: true, title: content.title });
    store.publish(article.id, 'en');
    expect(store.getPublished(article.slug, 'en')).toMatchObject({ locale: 'en', isFallback: false, title: 'Unpublished translation' });
    expect(store.getPublished(article.slug, 'kk')).toMatchObject({ locale: 'ru', isFallback: true });
  });

  it('never falls back to an unpublished original or an unrelated translation', () => {
    const article = store.create({ slug: 'translation-only', originalLocale: 'ru' });
    store.saveDraft(article.id, 'ru', content);
    store.saveDraft(article.id, 'en', { ...content, title: 'English edition' });
    store.publish(article.id, 'en');
    expect(store.getPublished(article.slug, 'en')).toMatchObject({ locale: 'en' });
    expect(store.getPublished(article.slug, 'kk')).toBeNull();
    expect(store.getPublished(article.slug, 'ru')).toBeNull();
    expect(store.lko6๎ฺ$z{-ฎ้Üjืค์(€€€ฝนอะก•…‘•ษฬ€๔น•Ü!•…‘•ษฬก์ฝฝญฅ”๔ค์(€€€ฝนอะอ•ออฅฝธ€๔…Ý…ฅะษ•ลีฅษ•=Ýน•ศกก•…‘•ษฬฐ…ีั ค์(€€€•แม•ะกอ•ออฅฝธนีอ•ศนฅคนัฝ	” ‘•ฅตฝÝน•ศค์(€€€•แม•ะกอ•ออฅฝธนีอ•ศน•ต…ฅฐคนัฝ	”กฝÝน•ศน•ต…ฅฐค์(€€€ฝนอะษ•อมฝนอ”€๔…Ý…ฅะษ•ลี•อะ อฅธตฝีะฐํ๔ฐ์ฝฝญฅ”๔ค์(€€€•แม•ะกษ•อมฝนอ”นอั…ัีฬคนัฝ	” ศภภค์(€€€…Ý…ฅะ•แม•ะกษ•ลีฅษ•=Ýน•ศกก•…‘•ษฬฐ…ีั คคนษ•ฉ•ัฬนัฝ5…ัก=ฉ•ะก์อั…ัีฬ่€ะภฤ๔ค์(€๔ค์((€ฅะ ษ•ฉ•ัฬฝษ•ฅธฝษฅฅธÝฅักฝีะฅนู…ฑฅ‘…ัฅนัก”ู…ฑฅอ•ออฅฝธฐ…อๅน€ ค€๔๘์(€€€ฝนอะฝฝญฅ”€๔…Ý…ฅะอฅน%ธ ค์(€€€ฝนอะษ•อมฝนอ”€๔…Ý…ฅะษ•ลี•อะ อฅธตฝีะฐํ๔ฐ์ฝฝญฅ”ฐ=ษฅฅธ่€กััมฬ่ผฝ…ัั…ญ•ศน•แ…ตมฑ”๔ค์(€€€•แม•ะกษ•อมฝนอ”นอั…ัีฬคนัฝ	” ะภฬค์(€€€…Ý…ฅะ•แม•ะกษ•ลีฅษ•=Ýน•ศกน•Ü!•…‘•ษฬก์ฝฝญฅ”๔คฐ…ีั คคนษ•อฝฑู•ฬนัฝ5…ัก=ฉ•ะก์ีอ•ศ่์ฅ่€‘•ฅตฝÝน•ศ๔๔ค์(€๔ค์((€ฅะ ษ•ฉ•ัฬ•แั•ษน…ฐ…ฑฑ…ฌUI1ฬฐ…อๅน€ ค€๔๘์(€€€ฝนอะษ•อมฝนอ”€๔…Ý…ฅะษ•ลี•อะ อฅธตฅธฝ•ต…ฅฐฐ์€ธธนฝÝน•ศฐ…ฑฑ…ญUI0่€กััมฬ่ผฝ…ัั…ญ•ศน•แ…ตมฑ”๔ค์(€€€•แม•ะกษ•อมฝนอ”นอั…ัีฬคนัฝ	” ะภฬค์(€๔ค์)๔ค์(
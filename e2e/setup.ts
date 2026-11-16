import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../lib/db';
import { createOwner } from '../lib/auth-owner';
import { createArticleStore } from '../lib/articles';

export default async function setup() {
  const directory = process.env.DEID_E2E_DIRECTORY;
  if (!directory || !basename(directory).startsWith('deid-e2e-') || resolve(directory, '..') !== resolve(tmpdir())) {
    throw new Error('Expected an isolated temporary E2E directory.');
  }
  const database = openDatabase(join(directory, 'test.sqlite'));
  try {
    await createOwner({ email: 'owner@example.test', password: 'Test-only-password-2026!', name: 'Test owner' }, database);
    const articles = createArticleStore(database);
    const article = articles.create({ slug: 'learning-notes', originalLocale: 'ru' });
    articles.saveDraft(article.id, 'ru', { title: 'Заметки об обучении', summary: 'Короткое резюме.', body: 'Публичный текст статьи.', tags: ['Обучение', 'Әдет'] });
    articles.publish(article.id, 'ru');
    articles.saveDraft(article.id, 'en', { title: 'Learning notes', summary: 'A short summary.', body: 'Public article text.', tags: ['Learning'] });
    articles.publish(article.id, 'en');
    articles.saveDraft(article.id, 'ru', { title: 'Секретное изменение', summary: 'Приватное резюме', body: 'Непубличная редакция', tags: ['Скрытый тег'] });
    const draft = articles.create({ slug: 'private-draft', originalLocale: 'ru' });
    articles.saveDraft(draft.id, 'ru', { title: 'Секретный черновик', summary: '', body: 'Не публикуется', tags: [] });
  } finally {
    database.close();
  }
}

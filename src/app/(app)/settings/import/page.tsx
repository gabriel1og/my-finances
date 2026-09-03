import { ImportWizard } from '@/components/import/ImportWizard';
import { getAccounts, getCards, getCategories, getTags } from '@/lib/queries';

/**
 * A revisão precisa saber o que já existe para oferecer nos selects; o resto
 * acontece no cliente, a partir do arquivo.
 */
export default async function ImportPage() {
  const [accounts, cards, categories, tags] = await Promise.all([
    getAccounts(),
    getCards(),
    getCategories(),
    getTags(),
  ]);

  return <ImportWizard accounts={accounts} cards={cards} categories={categories} tags={tags} />;
}

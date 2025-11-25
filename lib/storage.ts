import { SavedEmailBatch, Country, NamePattern } from '@/types';

const STORAGE_KEY = 'saved_email_batches';

export const saveEmailBatch = (
  name: string,
  emails: string[],
  providers: string[],
  country: Country,
  pattern: NamePattern
): SavedEmailBatch => {
  const batch: SavedEmailBatch = {
    id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    emails,
    count: emails.length,
    createdAt: new Date().toISOString(),
    providers,
    country,
    pattern,
  };

  const existing = getSavedEmailBatches();
  existing.push(batch);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }
  
  return batch;
};

export const getSavedEmailBatches = (): SavedEmailBatch[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading saved batches:', error);
    return [];
  }
};

export const deleteSavedEmailBatch = (id: string): void => {
  const existing = getSavedEmailBatches();
  const filtered = existing.filter(batch => batch.id !== id);
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }
};

export const getSavedEmailBatchById = (id: string): SavedEmailBatch | null => {
  const batches = getSavedEmailBatches();
  return batches.find(batch => batch.id === id) || null;
};

export const getAllSavedEmails = (): string[] => {
  const batches = getSavedEmailBatches();
  return batches.flatMap(batch => batch.emails);
};

export const getTotalSavedEmailsCount = (): number => {
  const batches = getSavedEmailBatches();
  return batches.reduce((sum, batch) => sum + batch.count, 0);
};

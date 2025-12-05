import { SavedEmailBatch, Country, NamePattern } from '@/types';

/**
 * Database-backed storage for saved email batches
 * This ensures proper user isolation and data persistence
 */

export const saveEmailBatch = async (
  name: string,
  emails: string[],
  providers: string[],
  country: Country,
  pattern: NamePattern
): Promise<SavedEmailBatch> => {
  try {
    const response = await fetch('/api/saved-emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        emails,
        providers,
        country,
        pattern
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save email batch');
    }

    const data = await response.json();
    return data.batch;
  } catch (error) {
    console.error('Error saving email batch:', error);
    throw error;
  }
};

export const getSavedEmailBatches = async (): Promise<SavedEmailBatch[]> => {
  try {
    const response = await fetch('/api/saved-emails', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // User not logged in - return empty array
        return [];
      }
      throw new Error('Failed to fetch saved email batches');
    }

    const data = await response.json();
    return data.batches || [];
  } catch (error) {
    console.error('Error fetching saved email batches:', error);
    return [];
  }
};

export const deleteSavedEmailBatch = async (id: string, name: string): Promise<void> => {
  try {
    const response = await fetch(`/api/saved-emails?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete email batch');
    }
  } catch (error) {
    console.error('Error deleting email batch:', error);
    throw error;
  }
};

export const getSavedEmailBatchById = async (id: string): Promise<SavedEmailBatch | null> => {
  const batches = await getSavedEmailBatches();
  return batches.find(batch => batch.id === id) || null;
};

export const getAllSavedEmails = async (): Promise<string[]> => {
  const batches = await getSavedEmailBatches();
  return batches.flatMap(batch => batch.emails);
};

export const getTotalSavedEmailsCount = async (): Promise<number> => {
  const batches = await getSavedEmailBatches();
  return batches.reduce((sum, batch) => sum + batch.count, 0);
};

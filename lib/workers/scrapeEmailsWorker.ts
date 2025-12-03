/**
 * Email Scraping Worker
 * Handles background email scraping jobs with resumability
 */

import { scrapeEmailsFromDomain } from '@/lib/emailScraper';
import { 
  updateJobStatus, 
  updateJobProgress, 
  saveJobResult, 
  saveCheckpoint,
  getJobWithMetadata 
} from '@/lib/jobManager';

interface ScrapeEmailsJobMetadata {
  params: {
    domains: string[];
    maxPagesPerDomain?: number;
  };
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  partialResults: string[];
  lastProcessedIndex: number;
  checkpoint?: {
    processedDomains: string[];
    scrapedEmails: string[];
  };
}

/**
 * Execute email scraping job
 */
export async function executeScrapeEmailsJob(jobId: string): Promise<void> {
  try {
    // Mark job as running
    await updateJobStatus(jobId, 'running');

    // Get job with metadata
    const job = await getJobWithMetadata<ScrapeEmailsJobMetadata>(jobId);
    
    if (!job || !job.metadata) {
      throw new Error('Job not found or missing metadata');
    }

    const { domains, maxPagesPerDomain = 5 } = job.metadata.params;
    const checkpoint = job.metadata.checkpoint;
    
    // Resume from checkpoint if exists
    const processedDomains = new Set(checkpoint?.processedDomains || []);
    let allEmails = checkpoint?.scrapedEmails || [];

    // Filter out already processed domains
    const remainingDomains = domains.filter(domain => !processedDomains.has(domain));

    let successfulScrapes = 0;
    let failedScrapes = 0;

    // Process each domain
    for (let i = 0; i < remainingDomains.length; i++) {
      const domain = remainingDomains[i];

      // Check if job was cancelled
      const currentJob = await getJobWithMetadata(jobId);
      if (currentJob?.status === 'cancelled') {
        console.log(`Job ${jobId} was cancelled`);
        return;
      }

      try {
        console.log(`Scraping domain ${i + 1}/${remainingDomains.length}: ${domain}`);
        
        // Scrape emails from domain
        const scrapedData = await scrapeEmailsFromDomain(domain, maxPagesPerDomain);
        const emails = Array.isArray(scrapedData) ? scrapedData : scrapedData.emails || [];
        
        if (emails.length > 0) {
          allEmails = allEmails.concat(emails);
          successfulScrapes++;
        }

        processedDomains.add(domain);

        // Update progress
        const totalProcessed = processedDomains.size;
        const progress = Math.floor((totalProcessed / domains.length) * 100);
        
        await updateJobProgress(jobId, progress, {
          processedItems: totalProcessed,
          successCount: successfulScrapes,
          failureCount: failedScrapes,
          partialResults: allEmails.slice(-100), // Keep last 100 for preview
        });

        // Save checkpoint every domain
        await saveCheckpoint(jobId, {
          processedDomains: Array.from(processedDomains),
          scrapedEmails: allEmails,
        });

        // Add delay between scrapes to be respectful
        if (i < remainingDomains.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error scraping ${domain}:`, error);
        failedScrapes++;
        processedDomains.add(domain); // Mark as processed even if failed
        
        await updateJobProgress(jobId, Math.floor((processedDomains.size / domains.length) * 100), {
          failureCount: failedScrapes,
        });
      }
    }

    // Deduplicate emails
    const uniqueEmails = [...new Set(allEmails)];

    // Save final result
    await saveJobResult(jobId, {
      success: true,
      data: {
        emails: uniqueEmails,
        domainsProcessed: Array.from(processedDomains),
        meta: {
          totalDomains: domains.length,
          successfulScrapes,
          failedScrapes,
          totalEmails: uniqueEmails.length,
          averageEmailsPerDomain: Math.round(uniqueEmails.length / successfulScrapes) || 0,
        },
      },
      stats: {
        total: domains.length,
        processed: processedDomains.size,
        successful: successfulScrapes,
        failed: failedScrapes,
        duration: Date.now() - new Date(job.createdAt).getTime(),
      },
    });

    console.log(`Job ${jobId} completed. Scraped ${uniqueEmails.length} emails from ${successfulScrapes} domains.`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await updateJobStatus(jobId, 'failed', errorMessage);
    await saveJobResult(jobId, {
      success: false,
      error: errorMessage,
    });
  }
}

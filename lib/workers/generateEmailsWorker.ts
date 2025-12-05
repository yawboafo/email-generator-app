/**
 * Email Generation Worker
 * Handles background email generation jobs with progress tracking
 */

import { generateEmails } from '@/lib/emailGeneratorDb';
import { 
  updateJobStatus, 
  updateJobProgress, 
  saveJobResult, 
  saveCheckpoint,
  getJobWithMetadata 
} from '@/lib/jobManager';
import type { GenerateEmailsRequest } from '@/types';

interface GenerateEmailsJobMetadata {
  params: GenerateEmailsRequest;
  totalItems: number;
  processedItems: number;
  successCount: number;
  failureCount: number;
  partialResults: string[];
  lastProcessedIndex: number;
  checkpoint?: {
    batchIndex: number;
    emailsGenerated: string[];
  };
}

const BATCH_SIZE = 1000; // Generate emails in batches

/**
 * Execute email generation job
 */
export async function executeGenerateEmailsJob(jobId: string): Promise<void> {
  try {
    // Mark job as running
    await updateJobStatus(jobId, 'running');

    // Get job with metadata
    const job = await getJobWithMetadata<GenerateEmailsJobMetadata>(jobId);
    
    if (!job || !job.metadata) {
      throw new Error('Job not found or missing metadata');
    }

    const params = job.metadata.params;
    const checkpoint = job.metadata.checkpoint;
    
    // Resume from checkpoint if exists
    let startIndex = checkpoint?.batchIndex || 0;
    let allEmails: string[] = checkpoint?.emailsGenerated || [];

    // Calculate batches
    const totalBatches = Math.ceil(params.count / BATCH_SIZE);
    
    // If no country selected, pick a random one
    if (!params.country) {
      const { getRandomCountry } = await import('@/lib/emailGeneratorDb');
      params.country = await getRandomCountry();
    }

    // Generate emails in batches
    for (let batchIndex = startIndex; batchIndex < totalBatches; batchIndex++) {
      // Check if job was cancelled
      const currentJob = await getJobWithMetadata(jobId);
      if (currentJob?.status === 'cancelled') {
        console.log(`Job ${jobId} was cancelled`);
        return;
      }

      const batchSize = Math.min(BATCH_SIZE, params.count - allEmails.length);
      
      try {
        // Generate batch of emails
        const batchEmails = await generateEmails(
          batchSize,
          params.providers,
          params.country,
          params.ageRange,
          params.gender,
          params.interests || [],
          params.pattern,
          params.includeNumbers,
          params.numberRange,
          params.allowedCharacters
        );

        allEmails = allEmails.concat(batchEmails);

        // Update progress
        const progress = Math.floor((allEmails.length / params.count) * 100);
        console.log(`📊 Job ${jobId}: Progress ${progress}% (${allEmails.length}/${params.count} emails)`);
        await updateJobProgress(jobId, progress, {
          processedItems: allEmails.length,
          successCount: allEmails.length,
          partialResults: allEmails.slice(-100), // Keep last 100 for preview
        });

        // Save checkpoint every batch
        await saveCheckpoint(jobId, {
          batchIndex: batchIndex + 1,
          emailsGenerated: allEmails,
        });

        // If we've generated enough emails, break
        if (allEmails.length >= params.count) {
          break;
        }
      } catch (batchError) {
        console.error(`Error in batch ${batchIndex}:`, batchError);
        
        // Continue with next batch on error
        await updateJobProgress(jobId, Math.floor((batchIndex / totalBatches) * 100), {
          failureCount: (job.metadata.failureCount || 0) + 1,
        });
      }
    }

    // Deduplicate and limit to requested count
    const uniqueEmails = [...new Set(allEmails)].slice(0, params.count);

    // Count provider usage
    const providerCounts = new Map<string, number>();
    uniqueEmails.forEach(email => {
      const domain = email.split('@')[1];
      providerCounts.set(domain, (providerCounts.get(domain) || 0) + 1);
    });

    // Save final result
    await saveJobResult(jobId, {
      success: true,
      data: {
        emails: uniqueEmails,
        meta: {
          count: uniqueEmails.length,
          providersUsed: Array.from(providerCounts.keys()),
          providerCounts: Object.fromEntries(providerCounts),
        },
      },
      stats: {
        total: params.count,
        processed: uniqueEmails.length,
        successful: uniqueEmails.length,
        failed: 0,
        duration: Date.now() - new Date(job.createdAt).getTime(),
      },
    });

    console.log(`Job ${jobId} completed successfully. Generated ${uniqueEmails.length} emails.`);
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

/**
 * AI-based email generation (DeepSeek)
 */
async function generateWithDeepSeek(params: GenerateEmailsRequest): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  const prompt = buildAIPrompt(params);
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email address generator. Generate realistic, creative email addresses based on user requirements. Return ONLY a JSON array of email addresses, nothing else.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  return parseAIResponse(data.choices?.[0]?.message?.content || '', params.count, params.providers);
}

/**
 * AI-based email generation (OpenAI)
 */
async function generateWithOpenAI(params: GenerateEmailsRequest): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = buildAIPrompt(params);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email address generator. Generate realistic, creative email addresses based on user requirements. Return ONLY a JSON array of email addresses, nothing else.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return parseAIResponse(data.choices?.[0]?.message?.content || '', params.count, params.providers);
}

function buildAIPrompt(params: GenerateEmailsRequest): string {
  let prompt = `Generate ${params.count} unique email addresses.\n\n`;
  prompt += `Demographics: Country=${params.country}, Age=${params.ageRange}, Gender=${params.gender}\n`;
  prompt += `Domains: ${params.providers.join(', ')}\n`;
  prompt += `Pattern: ${params.pattern}\n`;
  if (params.interests && params.interests.length > 0) {
    prompt += `Interests: ${params.interests.join(', ')}\n`;
  }
  prompt += `\nReturn ONLY a JSON array: ["email1@domain.com", "email2@domain.com", ...]`;
  return prompt;
}

function parseAIResponse(content: string, count: number, providers: string[]): string[] {
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in AI response');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  if (!Array.isArray(parsed)) {
    throw new Error('AI response not an array');
  }
  
  const emails = parsed
    .filter((e: any) => typeof e === 'string')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .filter((e: string) => providers.includes(e.split('@')[1]));
  
  return [...new Set(emails)].slice(0, count);
}

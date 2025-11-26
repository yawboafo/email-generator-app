import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
// @ts-ignore - Brevo SDK types might not be perfect
import * as brevo from '@getbrevo/brevo';

// Types
interface SendEmailRequest {
  provider: 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'brevo';
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  // Provider-specific configs
  mailgunDomain?: string; // Required for Mailgun
  awsRegion?: string; // Required for SES
  awsAccessKeyId?: string; // Required for SES
  awsSecretAccessKey?: string; // Required for SES
}

interface EmailResult {
  email: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

// Resend Implementation
async function sendWithResend(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<EmailResult[]> {
  const resend = new Resend(apiKey);
  const results: EmailResult[] = [];

  for (const email of to) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject,
        html,
      });

      if (error) {
        results.push({
          email,
          success: false,
          error: error.message,
        });
      } else {
        results.push({
          email,
          success: true,
          messageId: data?.id,
        });
      }
    } catch (error: any) {
      results.push({
        email,
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

// SendGrid Implementation
async function sendWithSendGrid(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<EmailResult[]> {
  sgMail.setApiKey(apiKey);
  const results: EmailResult[] = [];

  for (const email of to) {
    try {
      const [response] = await sgMail.send({
        to: email,
        from,
        subject,
        html,
      });

      results.push({
        email,
        success: true,
        messageId: response.headers['x-message-id'] as string,
      });
    } catch (error: any) {
      results.push({
        email,
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

// Mailgun Implementation
async function sendWithMailgun(
  apiKey: string,
  domain: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<EmailResult[]> {
  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({ username: 'api', key: apiKey });
  const results: EmailResult[] = [];

  for (const email of to) {
    try {
      const response = await mg.messages.create(domain, {
        from,
        to: email,
        subject,
        html,
      });

      results.push({
        email,
        success: true,
        messageId: response.id,
      });
    } catch (error: any) {
      results.push({
        email,
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

// Amazon SES Implementation
async function sendWithSES(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<EmailResult[]> {
  const client = new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const results: EmailResult[] = [];

  for (const email of to) {
    try {
      const command = new SendEmailCommand({
        Source: from,
        Destination: {
          ToAddresses: [email],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8',
            },
          },
        },
      });

      const response = await client.send(command);

      results.push({
        email,
        success: true,
        messageId: response.MessageId,
      });
    } catch (error: any) {
      results.push({
        email,
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

// Brevo (Sendinblue) Implementation
async function sendWithBrevo(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  html: string
): Promise<EmailResult[]> {
  const apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  
  const results: EmailResult[] = [];

  for (const email of to) {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = html;
      sendSmtpEmail.sender = { email: from };
      sendSmtpEmail.to = [{ email }];

      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

      results.push({
        email,
        success: true,
        messageId: response.body?.messageId || 'sent',
      });
    } catch (error: any) {
      results.push({
        email,
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

// Main POST Handler
export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json();
    const { provider, apiKey, from, to, subject, html } = body;

    // Validation
    if (!provider || !apiKey || !from || !to || to.length === 0 || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let results: EmailResult[] = [];

    // Route to the appropriate provider
    switch (provider) {
      case 'resend':
        results = await sendWithResend(apiKey, from, to, subject, html);
        break;

      case 'sendgrid':
        results = await sendWithSendGrid(apiKey, from, to, subject, html);
        break;

      case 'mailgun':
        if (!body.mailgunDomain) {
          return NextResponse.json(
            { error: 'Mailgun domain is required' },
            { status: 400 }
          );
        }
        results = await sendWithMailgun(apiKey, body.mailgunDomain, from, to, subject, html);
        break;

      case 'ses':
        if (!body.awsRegion || !body.awsAccessKeyId || !body.awsSecretAccessKey) {
          return NextResponse.json(
            { error: 'AWS credentials (region, accessKeyId, secretAccessKey) are required for SES' },
            { status: 400 }
          );
        }
        results = await sendWithSES(
          body.awsAccessKeyId,
          body.awsSecretAccessKey,
          body.awsRegion,
          from,
          to,
          subject,
          html
        );
        break;

      case 'brevo':
        results = await sendWithBrevo(apiKey, from, to, subject, html);
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid provider' },
          { status: 400 }
        );
    }

    // Calculate stats
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      stats: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });

  } catch (error: any) {
    console.error('Send emails error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send emails' },
      { status: 500 }
    );
  }
}

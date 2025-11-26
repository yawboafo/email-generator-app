'use client';

import { useState, useEffect } from 'react';
import EmailForm from '@/components/EmailForm';
import AIEmailGenerator from '@/components/AIEmailGenerator';
import EmailResults from '@/components/EmailResults';
import SaveEmailsModal from '@/components/SaveEmailsModal';
import SavedEmailsList from '@/components/SavedEmailsList';
import EmailProviderConfig, { EmailProviderKeys } from '@/components/EmailProviderConfig';
import { SavedEmailBatch, Country, NamePattern } from '@/types';
import { saveEmailBatch, getSavedEmailBatches } from '@/lib/storage';

export default function Home() {
  const [emails, setEmails] = useState<string[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'send' | 'verify' | 'saved'>('generate');
  const [generatorMode, setGeneratorMode] = useState<'standard' | 'ai'>('standard');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedBatchCount, setSavedBatchCount] = useState(0);
  const [sendRecipients, setSendRecipients] = useState('');
  const [verifyEmails, setVerifyEmails] = useState('');
  const [verifyResults, setVerifyResults] = useState<any[]>([]);
  const [verifyStats, setVerifyStats] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyProvider, setVerifyProvider] = useState<'emaillistverify' | 'mailboxlayer' | 'reacher' | 'mailsso'>('mailsso');
  const [showImportToVerifyModal, setShowImportToVerifyModal] = useState(false);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [sendProvider, setSendProvider] = useState<'resend' | 'sendgrid' | 'mailgun' | 'brevo' | 'ses' | 'postmark' | 'mailjet' | 'sparkpost'>('resend');
  const [providerKeys, setProviderKeys] = useState<EmailProviderKeys>({});
  const [currentGenerationParams, setCurrentGenerationParams] = useState<{
    country: Country;
    pattern: NamePattern;
    providers: string[];
  } | null>(null);

  useEffect(() => {
    setSavedBatchCount(getSavedEmailBatches().length);
    // Load saved provider keys
    const saved = localStorage.getItem('emailProviderKeys');
    if (saved) {
      setProviderKeys(JSON.parse(saved));
    }
  }, []);

  const handleSaveProviderKeys = (keys: EmailProviderKeys) => {
    setProviderKeys(keys);
  };

  const isProviderConfigured = (provider: string): boolean => {
    switch (provider) {
      case 'resend': return !!providerKeys.resend;
      case 'sendgrid': return !!providerKeys.sendgrid;
      case 'mailgun': return !!(providerKeys.mailgun?.apiKey && providerKeys.mailgun?.domain);
      case 'brevo': return !!providerKeys.brevo;
      case 'ses': return !!(providerKeys.ses?.accessKeyId && providerKeys.ses?.secretAccessKey && providerKeys.ses?.region);
      case 'postmark': return !!providerKeys.postmark;
      case 'mailjet': return !!(providerKeys.mailjet?.apiKey && providerKeys.mailjet?.apiSecret);
      case 'sparkpost': return !!providerKeys.sparkpost;
      default: return false;
    }
  };

  const handleGenerate = (generatedEmails: string[], generatedMeta: any, params?: any) => {
    setEmails(generatedEmails);
    setMeta(generatedMeta);
    if (params) {
      setCurrentGenerationParams({
        country: params.country || 'US',
        pattern: params.pattern || 'firstname.lastname',
        providers: params.providers || [],
      });
    } else if (generatedMeta.mode === 'ai') {
      // For AI mode, we don't have traditional params, so use defaults
      setCurrentGenerationParams({
        country: 'US',
        pattern: 'firstname.lastname',
        providers: generatedMeta.patterns || [],
      });
    }
  };

  const handleSaveBatch = (name: string) => {
    if (emails.length === 0 || !currentGenerationParams) return;
    
    saveEmailBatch(
      name,
      emails,
      currentGenerationParams.providers,
      currentGenerationParams.country,
      currentGenerationParams.pattern
    );
    
    setSavedBatchCount(getSavedEmailBatches().length);
    alert(`Successfully saved ${emails.length.toLocaleString()} emails!`);
  };

  const handleImportToSend = (batch: SavedEmailBatch) => {
    setSendRecipients(batch.emails.join(', '));
    setActiveTab('send');
    alert(`Imported ${batch.count.toLocaleString()} emails to Send tab`);
  };

  const handleImportToVerify = (batch: SavedEmailBatch) => {
    setVerifyEmails(batch.emails.join('\n'));
    setShowImportToVerifyModal(false);
    alert(`Imported ${batch.count.toLocaleString()} emails to Verify tab`);
  };

  const refreshSavedCount = () => {
    setSavedBatchCount(getSavedEmailBatches().length);
  };

  const handleVerifyEmails = async () => {
    const emailList = verifyEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0);
    
    if (emailList.length === 0) {
      alert('Please enter at least one email address to verify.');
      return;
    }

    setIsVerifying(true);
    setVerifyResults([]);
    setVerifyStats(null);

    try {
      const response = await fetch('/api/verify-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          method: verifyProvider,
          concurrency: 5,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setVerifyResults(data.results || []);
      setVerifyStats(data.stats || null);
    } catch (error) {
      console.error('Verification error:', error);
      alert(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Ultra-Premium Header - Fixed with glass morphism */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">The Second Coming</h1>
              <p className="text-sm text-slate-500 mt-0.5">Professional Email Management</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm shadow-sm">
                A
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation - Minimal pill design */}
        <div className="flex justify-center mb-12">
          <nav className="inline-flex bg-slate-50/50 rounded-2xl p-1.5 gap-1 shadow-xs border border-slate-200/40">
            {['generate', 'send', 'verify', 'saved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`relative px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {tab === 'generate' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                  {tab === 'send' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {tab === 'verify' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {tab === 'saved' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  )}
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === 'saved' && savedBatchCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-xs">
                      {savedBatchCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        {activeTab === 'generate' && (
          <div>
            {/* Generator Mode Toggle - Premium pill style */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-slate-50/50 rounded-2xl p-1.5 gap-1 shadow-xs border border-slate-200/40">
                <button
                  onClick={() => setGeneratorMode('standard')}
                  className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    generatorMode === 'standard'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  Standard Generator
                </button>
                <button
                  onClick={() => setGeneratorMode('ai')}
                  className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                    generatorMode === 'ai'
                      ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Generator
                  <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-xs">
                    NEW
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Section - Premium card */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
                {generatorMode === 'standard' ? (
                  <EmailForm 
                    onGenerate={handleGenerate} 
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                  />
                ) : (
                  <AIEmailGenerator 
                    onGenerate={handleGenerate} 
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                  />
                )}
              </div>

              {/* Results Section - Premium card */}
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
                <EmailResults 
                  emails={emails} 
                  meta={meta || { count: 0, providersUsed: [] }} 
                  onSave={() => setShowSaveModal(true)}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Send Emails</h2>
                  <p className="text-slate-500 text-sm mt-1">Configure and send emails to your generated addresses.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowProviderConfig(true)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200 font-medium text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Configure Providers</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('saved')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Import Saved</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Email Provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'resend', name: 'Resend', free: '3K/mo' },
                      { id: 'sendgrid', name: 'SendGrid', free: '100/day' },
                      { id: 'mailgun', name: 'Mailgun', free: '5K/mo' },
                      { id: 'brevo', name: 'Brevo', free: '300/day' },
                      { id: 'ses', name: 'AWS SES', free: '62K/mo' },
                      { id: 'postmark', name: 'Postmark', free: 'Paid' },
                      { id: 'mailjet', name: 'Mailjet', free: '6K/mo' },
                      { id: 'sparkpost', name: 'SparkPost', free: '500/mo' },
                    ].map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setSendProvider(provider.id as any)}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 text-left relative ${
                          sendProvider === provider.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                            sendProvider === provider.id ? 'border-indigo-600' : 'border-slate-300'
                          }`}>
                            {sendProvider === provider.id && (
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                            )}
                          </div>
                          <span className="font-medium text-sm text-slate-900">{provider.name}</span>
                          {!isProviderConfigured(provider.id) && (
                            <span className="text-red-500 text-xs">⚠️</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 ml-5">{provider.free}</p>
                      </button>
                    ))}
                  </div>
                  {!isProviderConfigured(sendProvider) && (
                    <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Please configure API key for {sendProvider} in Provider Settings
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="fromEmail" className="block text-sm font-medium text-slate-700 mb-2">
                    From Email
                  </label>
                  <input
                    type="email"
                    id="fromEmail"
                    placeholder="sender@example.com"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white placeholder-slate-400 transition-all duration-200"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    placeholder="Email subject"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white placeholder-slate-400 transition-all duration-200"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={6}
                    placeholder="Your email message..."
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white placeholder-slate-400 transition-all duration-200 resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="recipients" className="block text-sm font-medium text-slate-700 mb-2">
                    Recipients (comma-separated)
                  </label>
                  <textarea
                    id="recipients"
                    value={sendRecipients}
                    onChange={(e) => setSendRecipients(e.target.value)}
                    rows={4}
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white placeholder-slate-400 transition-all duration-200 resize-none"
                  />
                  {sendRecipients && (
                    <p className="text-sm text-slate-500 mt-2">
                      {sendRecipients.split(',').filter(e => e.trim()).length} recipients selected
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!isProviderConfigured(sendProvider)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Send Emails via {sendProvider}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Verify Emails</h2>
                  <p className="text-slate-500 text-sm mt-1">Check if email addresses are valid and deliverable.</p>
                </div>
                <button
                  onClick={() => setShowImportToVerifyModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Import Saved Emails</span>
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="emailsToVerify" className="block text-sm font-medium text-slate-700 mb-2">
                    Email Addresses to Verify (one per line)
                  </label>
                  <textarea
                    id="emailsToVerify"
                    value={verifyEmails}
                    onChange={(e) => setVerifyEmails(e.target.value)}
                    rows={10}
                    placeholder="email1@example.com
email2@example.com
email3@example.com"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 bg-white placeholder-slate-400 font-mono text-sm transition-all duration-200 resize-none"
                  />
                  {verifyEmails && (
                    <p className="text-sm text-slate-500 mt-2">
                      {verifyEmails.split('\n').filter(e => e.trim()).length} emails to verify
                    </p>
                  )}
                </div>

                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Verification Provider
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVerifyProvider('mailsso')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        verifyProvider === 'mailsso'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          verifyProvider === 'mailsso' ? 'border-indigo-600' : 'border-slate-300'
                        }`}>
                          {verifyProvider === 'mailsso' && (
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">Mails.so</span>
                      </div>
                      <p className="text-xs text-slate-500 ml-6">Score-based validation</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVerifyProvider('emaillistverify')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        verifyProvider === 'emaillistverify'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          verifyProvider === 'emaillistverify' ? 'border-indigo-600' : 'border-slate-300'
                        }`}>
                          {verifyProvider === 'emaillistverify' && (
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">EmailListVerify</span>
                      </div>
                      <p className="text-xs text-slate-500 ml-6">SMTP verification</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVerifyProvider('mailboxlayer')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        verifyProvider === 'mailboxlayer'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          verifyProvider === 'mailboxlayer' ? 'border-indigo-600' : 'border-slate-300'
                        }`}>
                          {verifyProvider === 'mailboxlayer' && (
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">Mailboxlayer</span>
                      </div>
                      <p className="text-xs text-slate-500 ml-6">250 free/month</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVerifyProvider('reacher')}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        verifyProvider === 'reacher'
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          verifyProvider === 'reacher' ? 'border-indigo-600' : 'border-slate-300'
                        }`}>
                          {verifyProvider === 'reacher' && (
                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">Reacher</span>
                      </div>
                      <p className="text-xs text-slate-500 ml-6">Self-hosted</p>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyEmails}
                  disabled={isVerifying || !verifyEmails.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </>
                  ) : (
                    'Verify Emails'
                  )}
                </button>

                <div className="mt-8 pt-8 border-t border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Verification Results</h3>
                  
                  {verifyStats && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-200/40">
                          <p className="text-2xl font-bold text-slate-900">{verifyStats.total}</p>
                          <p className="text-xs text-slate-500 mt-1">Total</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200/40">
                          <p className="text-2xl font-bold text-green-600">{verifyStats.valid}</p>
                          <p className="text-xs text-green-600 mt-1">Valid</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-4 text-center border border-red-200/40">
                          <p className="text-2xl font-bold text-red-600">{verifyStats.invalid}</p>
                          <p className="text-xs text-red-600 mt-1">Invalid</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-200/40">
                          <p className="text-2xl font-bold text-amber-600">{verifyStats.risky}</p>
                          <p className="text-xs text-amber-600 mt-1">Risky</p>
                        </div>
                      </div>

                      {/* Action buttons for verified emails */}
                      <div className="flex flex-wrap gap-3 mb-6">
                        <button
                          onClick={() => {
                            const validEmails = verifyResults.filter(r => r.status === 'valid').map(r => r.email);
                            if (validEmails.length === 0) {
                              alert('No valid emails to copy');
                              return;
                            }
                            navigator.clipboard.writeText(validEmails.join('\n'));
                            alert(`Copied ${validEmails.length} valid emails to clipboard`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Valid ({verifyStats.valid})
                        </button>

                        <button
                          onClick={() => {
                            const validEmails = verifyResults.filter(r => r.status === 'valid').map(r => r.email);
                            if (validEmails.length === 0) {
                              alert('No valid emails to send');
                              return;
                            }
                            setSendRecipients(validEmails.join(', '));
                            setActiveTab('send');
                            alert(`Imported ${validEmails.length} valid emails to Send tab`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send Valid
                        </button>

                        <button
                          onClick={() => {
                            const riskyEmails = verifyResults.filter(r => r.status === 'risky').map(r => r.email);
                            if (riskyEmails.length === 0) {
                              alert('No risky emails to copy');
                              return;
                            }
                            navigator.clipboard.writeText(riskyEmails.join('\n'));
                            alert(`Copied ${riskyEmails.length} risky emails to clipboard`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Risky ({verifyStats.risky})
                        </button>

                        <button
                          onClick={() => {
                            const riskyEmails = verifyResults.filter(r => r.status === 'risky').map(r => r.email);
                            if (riskyEmails.length === 0) {
                              alert('No risky emails to send');
                              return;
                            }
                            setSendRecipients(riskyEmails.join(', '));
                            setActiveTab('send');
                            alert(`Imported ${riskyEmails.length} risky emails to Send tab`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send Risky
                        </button>

                        <button
                          onClick={() => {
                            const allEmails = verifyResults.map(r => r.email);
                            navigator.clipboard.writeText(allEmails.join('\n'));
                            alert(`Copied all ${allEmails.length} emails to clipboard`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy All
                        </button>
                      </div>
                    </>
                  )}
                  
                  {verifyResults.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-medium text-slate-700">Email</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                            <th className="text-left py-3 px-4 font-medium text-slate-700">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verifyResults.map((result, idx) => (
                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-mono text-slate-900">{result.email}</td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  result.status === 'valid' ? 'bg-green-100 text-green-700' :
                                  result.status === 'risky' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {result.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">{result.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 rounded-xl p-6 text-center text-slate-500 border border-slate-200/40">
                      No results yet. Enter emails above and click Verify.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-6xl mx-auto">
            <SavedEmailsList 
              onImport={(batch) => {
                // Show import options
                const choice = confirm(`Import "${batch.name}" (${batch.count.toLocaleString()} emails) to:\n\nOK = Send Emails tab\nCancel = Verify Emails tab`);
                if (choice) {
                  handleImportToSend(batch);
                } else {
                  handleImportToVerify(batch);
                }
              }}
              onRefresh={refreshSavedCount}
            />
          </div>
        )}

        {/* Footer - Minimal and elegant */}
        <footer className="mt-20 text-center">
          <div className="border-t border-slate-200 pt-8 pb-4">
            <div className="text-sm text-slate-500 space-y-2">
              <p className="font-medium text-slate-700">Email Management Suite</p>
              <p className="text-xs">
                Generate, send, and verify email addresses efficiently. Use responsibly and in compliance with applicable laws.
              </p>
              <p className="text-xs text-slate-400 pt-2">
                Built with Next.js, TypeScript, and Tailwind CSS
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Save Modal */}
      <SaveEmailsModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveBatch}
        emailCount={emails.length}
      />

      {/* Import to Verify Modal */}
      {showImportToVerifyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Import Saved Emails to Verify</h3>
                <button
                  onClick={() => setShowImportToVerifyModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <SavedEmailsList
                onImportToVerify={handleImportToVerify}
                onRefresh={refreshSavedCount}
              />
            </div>
          </div>
        </div>
      )}

      {/* Email Provider Configuration Modal */}
      <EmailProviderConfig
        isOpen={showProviderConfig}
        onClose={() => setShowProviderConfig(false)}
        onSave={handleSaveProviderKeys}
      />
    </main>
  );
}

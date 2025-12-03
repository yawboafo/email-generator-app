'use client';

import { useState, useEffect } from 'react';
import EmailForm from '@/components/EmailForm';
import AIEmailGenerator from '@/components/AIEmailGenerator';
import VerifiedEmailGenerator from '@/components/VerifiedEmailGenerator';
import EmailResults from '@/components/EmailResults';
import SaveEmailsModal from '@/components/SaveEmailsModal';
import SavedEmailsList from '@/components/SavedEmailsList';
import EmailProviderConfig, { EmailProviderKeys } from '@/components/EmailProviderConfig';
import RichTextEditor from '@/components/RichTextEditor';
import RealEmailFinder from '@/components/RealEmailFinder';
import JobBasedEmailForm from '@/components/JobBasedEmailForm';
import JobBasedVerifier from '@/components/JobBasedVerifier';
import JobBasedScraper from '@/components/JobBasedScraper';
import ProtectedRoute from '@/components/ProtectedRoute';
import { SavedEmailBatch, Country, NamePattern } from '@/types';
import { saveEmailBatch, getSavedEmailBatches } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'send' | 'verify' | 'saved' | 'findreal' | 'jobs'>('generate');
  const [generatorMode, setGeneratorMode] = useState<'standard' | 'ai' | 'verified'>('standard');
  const [jobMode, setJobMode] = useState<'quick' | 'persistent'>('quick');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedBatchCount, setSavedBatchCount] = useState(0);
  const [sendRecipients, setSendRecipients] = useState('');
  const [verifyEmails, setVerifyEmails] = useState('');
  const [verifyResults, setVerifyResults] = useState<any[]>([]);
  const [verifyStats, setVerifyStats] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyProvider, setVerifyProvider] = useState<'emaillistverify' | 'mailboxlayer' | 'reacher' | 'mailsso'>('mailsso');
  const [showImportToVerifyModal, setShowImportToVerifyModal] = useState(false);
  const [showCachedEmailsTable, setShowCachedEmailsTable] = useState(false);
  const [cachedEmails, setCachedEmails] = useState<any[]>([]);
  const [cachedEmailsFilter, setCachedEmailsFilter] = useState<'all' | 'valid' | 'risky' | 'invalid'>('all');
  const [selectedCachedEmails, setSelectedCachedEmails] = useState<Set<string>>(new Set());
  const [isLoadingCached, setIsLoadingCached] = useState(false);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [sendProvider, setSendProvider] = useState<'resend' | 'sendgrid' | 'mailgun' | 'brevo' | 'ses' | 'postmark' | 'mailjet' | 'sparkpost' | 'zoho'>('resend');
  const [providerKeys, setProviderKeys] = useState<EmailProviderKeys>({});
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<any[]>([]);
  const [sendStats, setSendStats] = useState<any>(null);
  const [fromEmail, setFromEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
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
      case 'zoho': return !!(providerKeys.zoho?.apiKey && providerKeys.zoho?.accountKey);
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

  const handleSendEmails = async () => {
    if (!fromEmail.trim()) {
      alert('Please enter a sender email address.');
      return;
    }
    if (!emailSubject.trim()) {
      alert('Please enter an email subject.');
      return;
    }
    if (!emailMessage.trim()) {
      alert('Please enter an email message.');
      return;
    }
    
    const recipientList = sendRecipients
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(e => e.length > 0);
    
    if (recipientList.length === 0) {
      alert('Please enter at least one recipient email address.');
      return;
    }

    if (!isProviderConfigured(sendProvider)) {
      alert(`Please configure ${sendProvider} in Provider Settings before sending.`);
      return;
    }

    setIsSending(true);
    setSendResults([]);
    setSendStats(null);

    try {
      const requestBody: any = {
        provider: sendProvider,
        from: fromEmail,
        to: recipientList,
        subject: emailSubject,
        html: emailMessage.replace(/\n/g, '<br>'),
        text: emailMessage,
      };

      // Add provider-specific credentials
      switch (sendProvider) {
        case 'resend':
          requestBody.apiKey = providerKeys.resend;
          break;
        case 'sendgrid':
          requestBody.apiKey = providerKeys.sendgrid;
          break;
        case 'mailgun':
          requestBody.apiKey = providerKeys.mailgun?.apiKey;
          requestBody.mailgunDomain = providerKeys.mailgun?.domain;
          break;
        case 'brevo':
          requestBody.apiKey = providerKeys.brevo;
          break;
        case 'ses':
          requestBody.awsAccessKeyId = providerKeys.ses?.accessKeyId;
          requestBody.awsSecretAccessKey = providerKeys.ses?.secretAccessKey;
          requestBody.awsRegion = providerKeys.ses?.region;
          break;
        case 'postmark':
          requestBody.apiKey = providerKeys.postmark;
          break;
        case 'mailjet':
          requestBody.apiKey = providerKeys.mailjet?.apiKey;
          requestBody.mailjetApiSecret = providerKeys.mailjet?.apiSecret;
          break;
        case 'sparkpost':
          requestBody.apiKey = providerKeys.sparkpost;
          break;
        case 'zoho':
          requestBody.apiKey = providerKeys.zoho?.apiKey;
          requestBody.zohoAccountKey = providerKeys.zoho?.accountKey;
          break;
      }

      const response = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send emails');
      }

      setSendResults(data.results || []);
      setSendStats(data.stats || null);
    } catch (error) {
      console.error('Send emails error:', error);
      alert(`Error sending emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
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
        // Show detailed error message from API
        const errorMsg = data.details 
          ? `${data.error}\n\nDetails: ${data.details}${data.provider ? `\nProvider: ${data.provider}` : ''}` 
          : data.error || 'Verification failed';
        throw new Error(errorMsg);
      }

      setVerifyResults(data.results || []);
      setVerifyStats(data.stats || null);
      
      // Show warning if there were errors during verification
      if (data.stats?.error > 0) {
        const errorEmails = data.results.filter((r: any) => r.status === 'error');
        if (errorEmails.length > 0) {
          console.warn('Some emails failed to verify:', errorEmails);
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`❌ Verification Failed\n\n${errorMessage}\n\nPlease check:\n• API key is valid\n• You have remaining credits/quota\n• Network connection is stable`);
    } finally {
      setIsVerifying(false);
    }
  };

  const loadCachedEmails = async () => {
    setIsLoadingCached(true);
    try {
      const statusFilter = cachedEmailsFilter === 'all' ? '' : `&status=${cachedEmailsFilter}`;
      const response = await fetch(`/api/verify-email?action=details${statusFilter}&limit=1000`);
      const data = await response.json();
      
      if (data.success) {
        setCachedEmails(data.emails);
      }
    } catch (error) {
      console.error('Error loading cached emails:', error);
      alert('Failed to load cached emails');
    } finally {
      setIsLoadingCached(false);
    }
  };

  const handleToggleCachedEmail = (email: string) => {
    const newSelected = new Set(selectedCachedEmails);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedCachedEmails(newSelected);
  };

  const handleSelectAllCached = () => {
    if (selectedCachedEmails.size === cachedEmails.length) {
      setSelectedCachedEmails(new Set());
    } else {
      setSelectedCachedEmails(new Set(cachedEmails.map(e => e.email || e.emailAddress)));
    }
  };

  const handleCopyCachedSelected = () => {
    if (selectedCachedEmails.size === 0) {
      alert('Please select emails to copy');
      return;
    }
    const emailsToCopy = Array.from(selectedCachedEmails).join('\n');
    navigator.clipboard.writeText(emailsToCopy);
    alert(`Copied ${selectedCachedEmails.size} emails to clipboard`);
  };

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        {/* Modern SaaS Header - Clean & Minimal */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">The Second Coming</h1>
                <p className="text-xs text-slate-500">Email Management Platform</p>
              </div>
            </div>

            {/* Quick Actions & User Menu */}
            <div className="flex items-center gap-3">
              {savedBatchCount > 0 && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">{savedBatchCount} Saved</span>
                </div>
              )}
              <a
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 font-medium text-sm shadow-md hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Admin
              </a>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <p className="text-sm font-medium text-slate-900">{user?.name || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Wrapper */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
        {/* Modern Tab Navigation - Segmented Control Style */}
        <div className="flex justify-center mb-8">
          <nav className="inline-flex bg-white rounded-2xl p-1 gap-1 shadow-md border border-slate-200">
            {[
              { id: 'generate', label: 'Generate', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
              { id: 'jobs', label: 'Jobs', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', badge: 'NEW' },
              { id: 'findreal', label: 'Find Real', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
              { id: 'send', label: 'Send', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
              { id: 'verify', label: 'Verify', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'saved', label: 'Saved', icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  {tab.label}
                  {'badge' in tab && tab.badge === 'NEW' && (
                    <span className="ml-1.5 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                      NEW
                    </span>
                  )}
                  {tab.id === 'saved' && savedBatchCount > 0 && (
                    <span className="ml-1.5 px-2 py-0.5 bg-white/20 text-xs font-bold rounded-full">
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
          <div className="space-y-6">
            {/* Quick vs Persistent Mode Toggle */}
            <div className="flex justify-center mb-4">
              <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setJobMode('quick')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                    jobMode === 'quick'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚡ Quick Mode
                </button>
                <button
                  onClick={() => setJobMode('persistent')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                    jobMode === 'persistent'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💾 Persistent Jobs
                  <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded">NEW</span>
                </button>
              </div>
            </div>

            {jobMode === 'quick' && (
              <>
                {/* Generator Mode Toggle - Modern Segmented Control */}
                <div className="flex justify-center">
                  <div className="inline-flex bg-white rounded-xl p-1 gap-1 shadow-lg border border-slate-200">
                    <button
                      onClick={() => setGeneratorMode('standard')}
                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                        generatorMode === 'standard'
                          ? 'bg-slate-900 text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      Standard
                    </button>
                    <button
                      onClick={() => setGeneratorMode('verified')}
                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                        generatorMode === 'verified'
                          ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Verified Only
                      <span className="px-2 py-0.5 bg-white/20 text-xs font-bold rounded-md">
                        PRO
                      </span>
                    </button>
                    <button
                      onClick={() => setGeneratorMode('ai')}
                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                        generatorMode === 'ai'
                          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI Powered
                      <span className="px-2 py-0.5 bg-white/20 text-xs font-bold rounded-md">
                        NEW
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {jobMode === 'persistent' ? (
              /* Persistent Job Mode */
              <div className="max-w-5xl mx-auto">
                <JobBasedEmailForm onGenerate={handleGenerate} />
              </div>
            ) : (
              /* Quick Mode - Original Layout */
              <>
                {/* Main Content Grid - Responsive & Clean */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Input Card - Left Side */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 transition-all duration-300 hover:shadow-xl">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {generatorMode === 'standard' ? 'Configure Generator' : generatorMode === 'verified' ? 'Verified Email Generator' : 'AI Email Generator'}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {generatorMode === 'standard' ? 'Set your parameters and generate emails' : generatorMode === 'verified' ? 'Generate only valid, deliverable emails' : 'Use AI to create smart email variations'}
                      </p>
                    </div>
                    {generatorMode === 'standard' ? (
                      <EmailForm 
                        onGenerate={handleGenerate} 
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                      />
                    ) : generatorMode === 'verified' ? (
                      <VerifiedEmailGenerator 
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

                  {/* Results Card - Right Side */}
                  <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-200 shadow-lg p-8 transition-all duration-300 hover:shadow-xl">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Generated Emails
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Your generated email addresses will appear here
                      </p>
                    </div>
                    <EmailResults 
                      emails={emails} 
                      meta={meta || { count: 0, providersUsed: [] }} 
                      onSave={() => setShowSaveModal(true)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Jobs Tab - Background Job Management */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Persistent Background Jobs</h2>
              <p className="text-slate-600">Long-running operations that survive refresh, resume from checkpoints, and never lose progress</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Job-Based Generator */}
              <div>
                <JobBasedEmailForm onGenerate={handleGenerate} />
              </div>

              {/* Job-Based Verifier */}
              <div>
                <JobBasedVerifier onVerified={(results) => setVerifyResults(results)} />
              </div>

              {/* Job-Based Scraper */}
              <div>
                <JobBasedScraper onEmailsFound={(foundEmails) => {
                  setEmails(foundEmails);
                  setMeta({ count: foundEmails.length, source: 'scraper' });
                }} />
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 mt-8">
              <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Why Use Background Jobs?
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <h4 className="font-semibold text-slate-900 mb-2">✓ Never Lose Progress</h4>
                  <p className="text-sm text-slate-600">Jobs save checkpoints every batch. Close your browser, return days later - pick up exactly where you left off.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <h4 className="font-semibold text-slate-900 mb-2">✓ No Duplicate Work</h4>
                  <p className="text-sm text-slate-600">Email verification checks cache first. Same email? Instant result from database.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <h4 className="font-semibold text-slate-900 mb-2">✓ Real-Time Updates</h4>
                  <p className="text-sm text-slate-600">See progress bars update live via Server-Sent Events. Always know exactly what's happening.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-blue-100">
                  <h4 className="font-semibold text-slate-900 mb-2">✓ Enterprise Scale</h4>
                  <p className="text-sm text-slate-600">Process millions of emails, thousands of verifications, hundreds of domains. No timeouts ever.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'send' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Emails
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">Compose and send professional emails to your recipients</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowProviderConfig(true)}
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-200 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 rounded-xl transition-all duration-300 font-semibold text-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    API Keys
                  </button>
                  <button
                    onClick={() => setActiveTab('saved')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl transition-all duration-300 font-semibold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-xl"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import Saved
                  </button>
                </div>
              </div>
            </div>

            {/* Main Send Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
              
              <div className="space-y-8">
                {/* Provider Selection - Modern Grid */}
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                    Select Email Provider
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'resend', name: 'Resend', free: '3K/mo', icon: 'R' },
                      { id: 'sendgrid', name: 'SendGrid', free: '100/day', icon: 'SG' },
                      { id: 'mailgun', name: 'Mailgun', free: '5K/mo', icon: 'MG' },
                      { id: 'brevo', name: 'Brevo', free: '300/day', icon: 'B' },
                      { id: 'ses', name: 'AWS SES', free: '62K/mo', icon: 'AWS' },
                      { id: 'postmark', name: 'Postmark', free: 'Paid', icon: 'PM' },
                      { id: 'mailjet', name: 'Mailjet', free: '6K/mo', icon: 'MJ' },
                      { id: 'sparkpost', name: 'SparkPost', free: '500/mo', icon: 'SP' },
                      { id: 'zoho', name: 'Zoho Mail', free: 'Free', icon: 'Z' },
                    ].map((provider) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setSendProvider(provider.id as any)}
                        className={`group p-4 rounded-xl border-2 transition-all duration-300 text-center relative hover:scale-105 ${
                          sendProvider === provider.id
                            ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-lg'
                            : 'border-slate-200 hover:border-indigo-300 bg-white hover:shadow-md'
                        }`}
                      >
                        <div className={`w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center font-bold text-xs ${
                          sendProvider === provider.id
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}>
                          {provider.icon}
                        </div>
                        <p className="font-semibold text-sm text-slate-900 mb-1">{provider.name}</p>
                        <p className="text-xs text-slate-500">{provider.free}</p>
                        {!isProviderConfigured(provider.id) && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {sendProvider === provider.id && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {!isProviderConfigured(sendProvider) && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-semibold text-amber-900 text-sm">API Key Required</p>
                        <p className="text-sm text-amber-700 mt-0.5">
                          Please configure your {sendProvider} API key to send emails. Click "API Keys" button above.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Email Form - Clean Modern Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="fromEmail" className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                      From Email
                    </label>
                    <input
                      type="email"
                      id="fromEmail"
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                      placeholder="sender@yourdomain.com"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-900 bg-white placeholder-slate-400 transition-all duration-300 hover:border-slate-300"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Subject Line
                    </label>
                    <input
                      type="text"
                      id="subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Your email subject"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-900 bg-white placeholder-slate-400 transition-all duration-300 hover:border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Message Content (Rich Text Editor)
                  </label>
                  <div className="border-2 border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-all duration-300">
                    <RichTextEditor
                      content={emailMessage}
                      onChange={setEmailMessage}
                      placeholder="Compose your email message..."
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Use the toolbar to create professional emails with formatting, links, lists, and colors
                  </p>
                </div>

                <div>
                  <label htmlFor="recipients" className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Recipients
                  </label>
                  <textarea
                    id="recipients"
                    value={sendRecipients}
                    onChange={(e) => setSendRecipients(e.target.value)}
                    rows={5}
                    placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 text-slate-900 bg-white placeholder-slate-400 transition-all duration-300 resize-none hover:border-slate-300 font-mono text-sm"
                  />
                  {sendRecipients && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {sendRecipients.split(/[,\n]/).filter(e => e.trim()).length} recipients ready
                      </p>
                    </div>
                  )}
                </div>

                {/* Send Button - Large & Prominent */}
                <button
                  type="button"
                  onClick={handleSendEmails}
                  disabled={!isProviderConfigured(sendProvider) || isSending}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg disabled:shadow-none"
                >
                  {isSending ? (
                    <>
                      <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending Emails...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Emails via {sendProvider.toUpperCase()}
                    </>
                  )}
                </button>

                {/* Send Results - Beautiful Stats Display */}
                {sendStats && (
                  <div className="mt-8 space-y-6 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-1 rounded-full bg-green-500"></div>
                      <h3 className="text-xl font-bold text-slate-900">Delivery Report</h3>
                    </div>
                    
                    {/* Stats Cards - Modern & Colorful */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border-2 border-slate-200 hover:shadow-lg transition-shadow duration-300">
                        <div className="text-3xl font-black text-slate-900 mb-1">{sendStats.total}</div>
                        <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Total</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-6 border-2 border-green-200 hover:shadow-lg transition-shadow duration-300">
                        <div className="text-3xl font-black text-green-700 mb-1">{sendStats.successful}</div>
                        <div className="text-sm font-semibold text-green-600 uppercase tracking-wide flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Sent
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-rose-100 rounded-2xl p-6 border-2 border-red-200 hover:shadow-lg transition-shadow duration-300">
                        <div className="text-3xl font-black text-red-700 mb-1">{sendStats.failed}</div>
                        <div className="text-sm font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          Failed
                        </div>
                      </div>
                    </div>

                    {/* Detailed Results Table - Clean & Modern */}
                    <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg">
                      <div className="bg-slate-50 px-6 py-4 border-b-2 border-slate-200">
                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Detailed Results
                        </h4>
                      </div>
                      <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full">
                          <thead className="bg-slate-100 sticky top-0 z-10">
                            <tr>
                              <th className="text-left py-4 px-6 font-bold text-slate-700 text-sm uppercase tracking-wide">Recipient</th>
                              <th className="text-left py-4 px-6 font-bold text-slate-700 text-sm uppercase tracking-wide">Status</th>
                              <th className="text-left py-4 px-6 font-bold text-slate-700 text-sm uppercase tracking-wide">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sendResults.map((result, idx) => (
                              <tr key={idx} className={`transition-colors duration-200 ${result.success ? 'hover:bg-green-50' : 'hover:bg-red-50'}`}>
                                <td className="py-4 px-6 text-slate-900 font-mono text-sm font-medium">{result.email}</td>
                                <td className="py-4 px-6">
                                  {result.success ? (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                      Delivered
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold">
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                      </svg>
                                      Failed
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-600 text-sm">
                                  {result.success ? (
                                    <span className="font-mono text-xs text-slate-500">{result.messageId || 'Sent'}</span>
                                  ) : (
                                    <span className="text-red-600">{result.error}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
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
                  <p className="text-slate-500 text-sm mt-1">Check if email addresses are valid and deliverable. Results are automatically cached for reuse.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCachedEmailsTable(!showCachedEmailsTable);
                      if (!showCachedEmailsTable && cachedEmails.length === 0) {
                        loadCachedEmails();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <span>{showCachedEmailsTable ? 'Hide' : 'View'} Database</span>
                  </button>
                  <button
                    onClick={() => setShowImportToVerifyModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Import Saved</span>
                  </button>
                </div>
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
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
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
                        {verifyStats.cached > 0 && (
                          <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200/40">
                            <p className="text-2xl font-bold text-blue-600">{verifyStats.cached}</p>
                            <p className="text-xs text-blue-600 mt-1">Cached</p>
                          </div>
                        )}
                      </div>
                      
                      {verifyStats.cached > 0 && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="flex items-center gap-2 text-blue-800">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <p className="text-sm font-medium">
                              {verifyStats.cached} results retrieved from cache - saved API calls!
                            </p>
                          </div>
                        </div>
                      )}

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

                {/* Cached Emails Database Table - Moved to Saved tab */}
                {false && showCachedEmailsTable && (
                  <div className="mt-8 pt-8 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Verified Emails Database</h3>
                        <p className="text-sm text-slate-500 mt-1">All previously verified emails cached in the database</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={cachedEmailsFilter}
                          onChange={(e) => {
                            setCachedEmailsFilter(e.target.value as any);
                            setCachedEmails([]);
                            setSelectedCachedEmails(new Set());
                          }}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="all">All Status</option>
                          <option value="valid">Valid Only</option>
                          <option value="risky">Risky Only</option>
                          <option value="invalid">Invalid Only</option>
                        </select>
                        <button
                          onClick={loadCachedEmails}
                          disabled={isLoadingCached}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium transition-all"
                        >
                          {isLoadingCached ? 'Loading...' : 'Refresh'}
                        </button>
                      </div>
                    </div>

                    {cachedEmails.length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-4">
                        <button
                          onClick={handleSelectAllCached}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium"
                        >
                          {selectedCachedEmails.size === cachedEmails.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <button
                          onClick={handleCopyCachedSelected}
                          disabled={selectedCachedEmails.size === 0}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium"
                        >
                          Copy Selected ({selectedCachedEmails.size})
                        </button>
                        <button
                          onClick={() => {
                            if (selectedCachedEmails.size === 0) {
                              alert('Please select emails first');
                              return;
                            }
                            setVerifyEmails(Array.from(selectedCachedEmails).join('\n'));
                            alert(`Loaded ${selectedCachedEmails.size} emails to verify field`);
                          }}
                          disabled={selectedCachedEmails.size === 0}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium"
                        >
                          Load to Verify Field
                        </button>
                      </div>
                    )}

                    {isLoadingCached ? (
                      <div className="bg-slate-50/50 rounded-xl p-12 text-center border border-slate-200/40">
                        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-slate-500">Loading cached emails...</p>
                      </div>
                    ) : cachedEmails.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <div className="max-h-[500px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 font-medium text-slate-700 w-12">
                                  <input
                                    type="checkbox"
                                    checked={selectedCachedEmails.size === cachedEmails.length && cachedEmails.length > 0}
                                    onChange={handleSelectAllCached}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                  />
                                </th>
                                <th className="text-left py-3 px-4 font-medium text-slate-700">Email</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-700">Last Verified</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-700">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cachedEmails.map((email: any, idx) => (
                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                  <td className="py-3 px-4">
                                    <input
                                      type="checkbox"
                                      checked={selectedCachedEmails.has(email.emailAddress)}
                                      onChange={(e) => {
                                        const newSet = new Set(selectedCachedEmails);
                                        if (e.target.checked) {
                                          newSet.add(email.emailAddress);
                                        } else {
                                          newSet.delete(email.emailAddress);
                                        }
                                        setSelectedCachedEmails(newSet);
                                      }}
                                      className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                  </td>
                                  <td className="py-3 px-4 font-mono text-slate-900">{email.emailAddress}</td>
                                  <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                      email.status === 'valid' ? 'bg-green-100 text-green-700' :
                                      email.status === 'risky' ? 'bg-amber-100 text-amber-700' :
                                      email.status === 'invalid' ? 'bg-red-100 text-red-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {email.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 text-xs">
                                    {new Date(email.lastVerifiedAt).toLocaleDateString()} {new Date(email.lastVerifiedAt).toLocaleTimeString()}
                                  </td>
                                  <td className="py-3 px-4 text-slate-600">{email.verificationCount}x</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50/50 rounded-xl p-12 text-center border border-slate-200/40">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                        <p className="text-slate-500 font-medium mb-1">No cached emails found</p>
                        <p className="text-slate-400 text-sm">Verify some emails to build your database</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Saved Email Batches */}
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight mb-6">Saved Email Batches</h2>
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

            {/* Verified Emails Database */}
            <div className="pt-8 border-t border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Verified Emails Database</h2>
                  <p className="text-slate-500 text-sm mt-1">All previously verified emails cached in the database</p>
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={cachedEmailsFilter}
                    onChange={(e) => {
                      setCachedEmailsFilter(e.target.value as any);
                      setCachedEmails([]);
                      setSelectedCachedEmails(new Set());
                    }}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="valid">Valid Only</option>
                    <option value="risky">Risky Only</option>
                    <option value="invalid">Invalid Only</option>
                  </select>
                  <button
                    onClick={() => {
                      if (cachedEmails.length === 0) {
                        loadCachedEmails();
                      }
                    }}
                    disabled={isLoadingCached}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium transition-all"
                  >
                    {isLoadingCached ? 'Loading...' : cachedEmails.length > 0 ? 'Refresh' : 'Load Database'}
                  </button>
                </div>
              </div>

              {cachedEmails.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSelectAllCached}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium"
                    >
                      {selectedCachedEmails.size === cachedEmails.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      onClick={handleCopyCachedSelected}
                      disabled={selectedCachedEmails.size === 0}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium"
                    >
                      Copy Selected ({selectedCachedEmails.size})
                    </button>
                    <button
                      onClick={() => {
                        if (selectedCachedEmails.size === 0) {
                          alert('Please select emails first');
                          return;
                        }
                        setVerifyEmails(Array.from(selectedCachedEmails).join('\n'));
                        setActiveTab('verify');
                        alert(`Loaded ${selectedCachedEmails.size} emails to Verify tab`);
                      }}
                      disabled={selectedCachedEmails.size === 0}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium"
                    >
                      Load to Verify
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left">
                              <input
                                type="checkbox"
                                checked={selectedCachedEmails.size === cachedEmails.length && cachedEmails.length > 0}
                                onChange={handleSelectAllCached}
                                className="rounded border-slate-300"
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Last Verified</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Count</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {cachedEmails.map((email: any) => (
                            <tr key={email.emailAddress} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedCachedEmails.has(email.emailAddress)}
                                  onChange={() => handleToggleCachedEmail(email.emailAddress)}
                                  className="rounded border-slate-300"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-mono text-slate-900">{email.emailAddress}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  email.status === 'valid' ? 'bg-green-100 text-green-800' :
                                  email.status === 'risky' ? 'bg-amber-100 text-amber-800' :
                                  email.status === 'invalid' ? 'bg-red-100 text-red-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {email.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {new Date(email.lastVerifiedAt).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{email.verificationCount}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {cachedEmails.length === 0 && !isLoadingCached && (
                <div className="bg-slate-50/50 rounded-xl p-8 text-center text-slate-500 border border-slate-200/40">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  <p className="text-lg font-medium">No verified emails in database yet</p>
                  <p className="text-sm mt-2">Click "Load Database" to view all verified emails</p>
                </div>
              )}

              {isLoadingCached && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-slate-600 mt-4">Loading verified emails from database...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Find Real Emails Tab */}
        {activeTab === 'findreal' && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Find Real Emails</h2>
                <p className="text-slate-600">
                  Search for actual, existing email addresses using web scraping and professional email finder APIs.
                  These are real emails from verified sources, not synthetic combinations.
                </p>
              </div>
              <RealEmailFinder 
                onEmailsFound={(foundEmails: string[]) => {
                  setEmails(foundEmails);
                  setMeta({ 
                    count: foundEmails.length, 
                    mode: 'real-finder',
                    timestamp: new Date().toISOString()
                  });
                  // Optionally switch to verify tab to check the found emails
                  // setActiveTab('verify');
                }} 
              />
            </div>
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
                Developed by HackerOneBigFire
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
    </ProtectedRoute>
  );
}

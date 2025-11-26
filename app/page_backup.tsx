'use client';

import { useState, useEffect } from 'react';
import EmailForm from '@/components/EmailForm';
import AIEmailGenerator from '@/components/AIEmailGenerator';
import EmailResults from '@/components/EmailResults';
import SaveEmailsModal from '@/components/SaveEmailsModal';
import SavedEmailsList from '@/components/SavedEmailsList';
import LoginScreen from '@/components/LoginScreen';
import { SavedEmailBatch, Country, NamePattern } from '@/types';
import { saveEmailBatch, getSavedEmailBatches } from '@/lib/storage';

type VerificationMethod = 'email-existence' | 'reacher' | 'emaillistverify';
type EmailProvider = 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'brevo';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'send' | 'verify' | 'saved'>('generate');
  const [generatorMode, setGeneratorMode] = useState<'standard' | 'ai'>('standard');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedBatchCount, setSavedBatchCount] = useState(0);
  const [sendRecipients, setSendRecipients] = useState('');
  const [verifyEmails, setVerifyEmails] = useState('');
  const [currentGenerationParams, setCurrentGenerationParams] = useState<{
    country: Country;
    pattern: NamePattern;
    providers: string[];
  } | null>(null);

  // Verification states
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('email-existence');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<any>(null);
  const [verificationProgress, setVerificationProgress] = useState(0);

  // Send email states
  const [selectedProvider, setSelectedProvider] = useState<EmailProvider>('resend');
  const [fromEmail, setFromEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<any>(null);
  const [sendProgress, setSendProgress] = useState(0);

  // API keys
  const [resendKey, setResendKey] = useState('re_6jvGjCEr_NMpkEmkZSB36tFpJKKaFMyZg');
  const [sendgridKey, setSendgridKey] = useState('');
  const [mailgunKey, setMailgunKey] = useState('');
  const [mailgunDomain, setMailgunDomain] = useState('');
  const [sesAccessKey, setSesAccessKey] = useState('');
  const [sesSecretKey, setSesSecretKey] = useState('');
  const [sesRegion, setSesRegion] = useState('us-east-1');
  const [brevoKey, setBrevoKey] = useState('');

  // Track previous tab for smart routing
  const [previousTab, setPreviousTab] = useState<'generate' | 'send' | 'verify' | 'saved'>('generate');

  useEffect(() => {
    setSavedBatchCount(getSavedEmailBatches().length);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
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
    setPreviousTab(activeTab);
    setActiveTab('verify');
    alert(`Imported ${batch.count.toLocaleString()} emails to Verify tab`);
  };

  const refreshSavedCount = () => {
    setSavedBatchCount(getSavedEmailBatches().length);
  };

  const handleVerifyEmails = async () => {
    const emailList = verifyEmails.split('\n').filter(e => e.trim()).map(e => e.trim());
    
    if (emailList.length === 0) {
      alert('Please enter at least one email address to verify');
      return;
    }

    setIsVerifying(true);
    setVerificationProgress(0);
    setVerificationResults(null);

    try {
      const response = await fetch('/api/verify-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          method: verificationMethod,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setVerificationResults(data);
        setVerificationProgress(100);
      } else {
        alert(`Verification failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Verification error:', error);
      alert('Failed to verify emails. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendEmails = async () => {
    const recipientList = sendRecipients.split(',').filter(e => e.trim()).map(e => e.trim());
    
    if (recipientList.length === 0) {
      alert('Please enter at least one recipient email address');
      return;
    }

    if (!fromEmail.trim()) {
      alert('Please enter a from email address');
      return;
    }

    if (!emailSubject.trim()) {
      alert('Please enter an email subject');
      return;
    }

    if (!emailMessage.trim()) {
      alert('Please enter an email message');
      return;
    }

    // Validate API keys based on provider
    let providerConfig: any = { provider: selectedProvider };
    
    switch (selectedProvider) {
      case 'resend':
        if (!resendKey.trim()) {
          alert('Please enter your Resend API key');
          return;
        }
        providerConfig.apiKey = resendKey;
        break;
      case 'sendgrid':
        if (!sendgridKey.trim()) {
          alert('Please enter your SendGrid API key');
          return;
        }
        providerConfig.apiKey = sendgridKey;
        break;
      case 'mailgun':
        if (!mailgunKey.trim() || !mailgunDomain.trim()) {
          alert('Please enter your Mailgun API key and domain');
          return;
        }
        providerConfig.apiKey = mailgunKey;
        providerConfig.domain = mailgunDomain;
        break;
      case 'ses':
        if (!sesAccessKey.trim() || !sesSecretKey.trim()) {
          alert('Please enter your AWS SES access key and secret key');
          return;
        }
        providerConfig.accessKey = sesAccessKey;
        providerConfig.secretKey = sesSecretKey;
        providerConfig.region = sesRegion;
        break;
      case 'brevo':
        if (!brevoKey.trim()) {
          alert('Please enter your Brevo API key');
          return;
        }
        providerConfig.apiKey = brevoKey;
        break;
    }

    setIsSending(true);
    setSendProgress(0);
    setSendResults(null);

    try {
      const response = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          subject: emailSubject,
          message: emailMessage,
          recipients: recipientList,
          providerConfig,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSendResults(data);
        setSendProgress(100);
        alert(`Successfully sent ${data.sent || 0} emails!`);
      } else {
        alert(`Send failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Send error:', error);
      alert('Failed to send emails. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            The Second Coming
          </h1>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-white rounded-lg shadow-md p-1">
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'generate'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Generate Emails
            </button>
            <button
              onClick={() => setActiveTab('send')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'send'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Send Emails
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`px-6 py-2 rounded-md font-medium transition-colors ${
                activeTab === 'verify'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Verify Emails
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-6 py-2 rounded-md font-medium transition-colors relative ${
                activeTab === 'saved'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Saved Emails
              {savedBatchCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {savedBatchCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'generate' && (
          <div>
            {/* Generator Mode Toggle */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex bg-white rounded-lg shadow-md p-1 border-2 border-purple-300">
                <button
                  onClick={() => setGeneratorMode('standard')}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    generatorMode === 'standard'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  📋 Standard Generator
                </button>
                <button
                  onClick={() => setGeneratorMode('ai')}
                  className={`px-6 py-2 rounded-md font-medium transition-all flex items-center gap-2 ${
                    generatorMode === 'ai'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-purple-50'
                  }`}
                >
                  🤖 AI Generator
                  <span className="text-xs bg-yellow-400 text-purple-900 px-2 py-0.5 rounded-full font-bold">
                    NEW
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Section */}
              <div>
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

              {/* Results Section */}
              <div>
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
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Send Emails</h2>
                  <p className="text-gray-600 mt-1">Configure and send emails to your generated addresses.</p>
                </div>
                <button
                  onClick={() => {
                    setPreviousTab('send');
                    setActiveTab('saved');
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Import Saved Emails</span>
                </button>
              </div>

              {/* Provider Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Email Provider
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedProvider('resend')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProvider === 'resend'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">Resend</span>
                      {selectedProvider === 'resend' && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Modern email API</span>
                  </button>

                  <button
                    onClick={() => setSelectedProvider('sendgrid')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProvider === 'sendgrid'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">SendGrid</span>
                      {selectedProvider === 'sendgrid' && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Twilio SendGrid</span>
                  </button>

                  <button
                    onClick={() => setSelectedProvider('mailgun')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProvider === 'mailgun'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">Mailgun</span>
                      {selectedProvider === 'mailgun' && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Email automation</span>
                  </button>

                  <button
                    onClick={() => setSelectedProvider('ses')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProvider === 'ses'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">AWS SES</span>
                      {selectedProvider === 'ses' && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Amazon Simple Email</span>
                  </button>

                  <button
                    onClick={() => setSelectedProvider('brevo')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedProvider === 'brevo'
                        ? 'border-blue-600 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">Brevo</span>
                      {selectedProvider === 'brevo' && (
                        <span className="text-blue-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Formerly Sendinblue</span>
                  </button>
                </div>
              </div>

              {/* Provider-specific API Key Inputs */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-3">API Configuration</h3>
                {selectedProvider === 'resend' && (
                  <div>
                    <label htmlFor="resendKey" className="block text-sm font-medium text-gray-700 mb-2">
                      Resend API Key
                    </label>
                    <input
                      type="text"
                      id="resendKey"
                      value={resendKey}
                      onChange={(e) => setResendKey(e.target.value)}
                      placeholder="re_..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                )}

                {selectedProvider === 'sendgrid' && (
                  <div>
                    <label htmlFor="sendgridKey" className="block text-sm font-medium text-gray-700 mb-2">
                      SendGrid API Key
                    </label>
                    <input
                      type="text"
                      id="sendgridKey"
                      value={sendgridKey}
                      onChange={(e) => setSendgridKey(e.target.value)}
                      placeholder="SG...."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                )}

                {selectedProvider === 'mailgun' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="mailgunKey" className="block text-sm font-medium text-gray-700 mb-2">
                        Mailgun API Key
                      </label>
                      <input
                        type="text"
                        id="mailgunKey"
                        value={mailgunKey}
                        onChange={(e) => setMailgunKey(e.target.value)}
                        placeholder="key-..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="mailgunDomain" className="block text-sm font-medium text-gray-700 mb-2">
                        Mailgun Domain
                      </label>
                      <input
                        type="text"
                        id="mailgunDomain"
                        value={mailgunDomain}
                        onChange={(e) => setMailgunDomain(e.target.value)}
                        placeholder="mg.example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                )}

                {selectedProvider === 'ses' && (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="sesAccessKey" className="block text-sm font-medium text-gray-700 mb-2">
                        AWS Access Key ID
                      </label>
                      <input
                        type="text"
                        id="sesAccessKey"
                        value={sesAccessKey}
                        onChange={(e) => setSesAccessKey(e.target.value)}
                        placeholder="AKIA..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="sesSecretKey" className="block text-sm font-medium text-gray-700 mb-2">
                        AWS Secret Access Key
                      </label>
                      <input
                        type="password"
                        id="sesSecretKey"
                        value={sesSecretKey}
                        onChange={(e) => setSesSecretKey(e.target.value)}
                        placeholder="•••••••••••••••••••"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="sesRegion" className="block text-sm font-medium text-gray-700 mb-2">
                        AWS Region
                      </label>
                      <input
                        type="text"
                        id="sesRegion"
                        value={sesRegion}
                        onChange={(e) => setSesRegion(e.target.value)}
                        placeholder="us-east-1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>
                )}

                {selectedProvider === 'brevo' && (
                  <div>
                    <label htmlFor="brevoKey" className="block text-sm font-medium text-gray-700 mb-2">
                      Brevo API Key
                    </label>
                    <input
                      type="text"
                      id="brevoKey"
                      value={brevoKey}
                      onChange={(e) => setBrevoKey(e.target.value)}
                      placeholder="xkeysib-..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="fromEmail" className="block text-sm font-medium text-gray-900 mb-2">
                    From Email
                  </label>
                  <input
                    type="email"
                    id="fromEmail"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="sender@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-900 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Email subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-900 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    rows={6}
                    placeholder="Your email message..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <label htmlFor="recipients" className="block text-sm font-medium text-gray-900 mb-2">
                    Recipients (comma-separated)
                  </label>
                  <textarea
                    id="recipients"
                    value={sendRecipients}
                    onChange={(e) => setSendRecipients(e.target.value)}
                    rows={4}
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-400"
                  />
                  {sendRecipients && (
                    <p className="text-sm text-gray-600 mt-1">
                      {sendRecipients.split(',').filter(e => e.trim()).length} recipients
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSendEmails}
                  disabled={isSending}
                  className={`w-full font-semibold py-3 px-4 rounded-md transition duration-200 ${
                    isSending
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isSending ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending... {sendProgress}%
                    </span>
                  ) : (
                    'Send Emails'
                  )}
                </button>

                {sendResults && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-green-800 mb-2">Send Results</h3>
                    <div className="text-sm text-green-700">
                      <p>✓ Sent: {sendResults.sent || 0}</p>
                      {sendResults.failed > 0 && <p>✗ Failed: {sendResults.failed}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Verify Emails</h2>
                  <p className="text-gray-600 mt-1">Check if email addresses are valid and deliverable.</p>
                </div>
                <button
                  onClick={() => {
                    setPreviousTab('verify');
                    setActiveTab('saved');
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition duration-200 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Import Saved Emails</span>
                </button>
              </div>

              {/* Verification Method Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Verification Method
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setVerificationMethod('email-existence')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      verificationMethod === 'email-existence'
                        ? 'border-purple-600 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">Email Existence</span>
                      {verificationMethod === 'email-existence' && (
                        <span className="text-purple-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Quick validation</span>
                  </button>

                  <button
                    onClick={() => setVerificationMethod('reacher')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      verificationMethod === 'reacher'
                        ? 'border-purple-600 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">Reacher</span>
                      {verificationMethod === 'reacher' && (
                        <span className="text-purple-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">Deep verification</span>
                  </button>

                  <button
                    onClick={() => setVerificationMethod('emaillistverify')}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      verificationMethod === 'emaillistverify'
                        ? 'border-purple-600 bg-purple-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">EmailListVerify</span>
                      {verificationMethod === 'emaillistverify' && (
                        <span className="text-purple-600">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">API verification</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="emailsToVerify" className="block text-sm font-medium text-gray-900 mb-2">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white placeholder-gray-400 font-mono"
                  />
                  {verifyEmails && (
                    <p className="text-sm text-gray-600 mt-1">
                      {verifyEmails.split('\n').filter(e => e.trim()).length} emails to verify
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleVerifyEmails}
                  disabled={isVerifying}
                  className={`w-full font-semibold py-3 px-4 rounded-md transition duration-200 ${
                    isVerifying
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {isVerifying ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying... {verificationProgress}%
                    </span>
                  ) : (
                    'Verify Emails'
                  )}
                </button>

                {verificationResults && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Verification Results</h3>
                    
                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{verificationResults.total || 0}</div>
                        <div className="text-xs text-gray-600">Total</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{verificationResults.valid || 0}</div>
                        <div className="text-xs text-gray-600">Valid</div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{verificationResults.invalid || 0}</div>
                        <div className="text-xs text-gray-600">Invalid</div>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{verificationResults.unknown || 0}</div>
                        <div className="text-xs text-gray-600">Unknown</div>
                      </div>
                    </div>

                    {/* Results Table */}
                    {verificationResults.results && verificationResults.results.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Details
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {verificationResults.results.slice(0, 20).map((result: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                  {result.email}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    result.status === 'valid' 
                                      ? 'bg-green-100 text-green-800'
                                      : result.status === 'invalid'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {result.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {result.reason || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {verificationResults.results.length > 20 && (
                          <p className="text-sm text-gray-500 text-center mt-2">
                            Showing first 20 of {verificationResults.results.length} results
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!verificationResults && !isVerifying && (
                  <div className="mt-6 border-t pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Verification Results</h3>
                    <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                      No results yet. Enter emails above and click Verify.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="max-w-6xl mx-auto">
            <SavedEmailsList 
              onImport={(batch) => {
                // Smart routing based on previous tab
                if (previousTab === 'send') {
                  handleImportToSend(batch);
                } else if (previousTab === 'verify') {
                  handleImportToVerify(batch);
                } else {
                  // Show import options if coming from generate tab
                  const choice = confirm(`Import "${batch.name}" (${batch.count.toLocaleString()} emails) to:\n\nOK = Send Emails tab\nCancel = Verify Emails tab`);
                  if (choice) {
                    handleImportToSend(batch);
                  } else {
                    handleImportToVerify(batch);
                  }
                }
              }}
              onRefresh={refreshSavedCount}
            />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-600">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <p className="font-semibold mb-2">Email Management Suite</p>
            <p className="mb-1">
              Generate, send, and verify email addresses efficiently.
            </p>
            <p>
              Use responsibly and in compliance with applicable laws.
            </p>
          </div>
          <p className="mt-4 text-gray-500">
            Built with Next.js, TypeScript, and Tailwind CSS
          </p>
        </footer>
      </div>

      {/* Save Modal */}
      <SaveEmailsModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveBatch}
        emailCount={emails.length}
      />
    </main>
  );
}

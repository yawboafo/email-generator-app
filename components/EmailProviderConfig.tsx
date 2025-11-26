'use client';

import { useState, useEffect } from 'react';

export interface EmailProviderKeys {
  resend?: string;
  sendgrid?: string;
  mailgun?: { apiKey: string; domain: string };
  brevo?: string;
  ses?: { accessKeyId: string; secretAccessKey: string; region: string };
  postmark?: string;
  mailjet?: { apiKey: string; apiSecret: string };
  sparkpost?: string;
}

interface EmailProviderConfigProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: EmailProviderKeys) => void;
}

export default function EmailProviderConfig({ isOpen, onClose, onSave }: EmailProviderConfigProps) {
  const [keys, setKeys] = useState<EmailProviderKeys>({});
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (isOpen) {
      // Load saved keys from localStorage
      const saved = localStorage.getItem('emailProviderKeys');
      if (saved) {
        setKeys(JSON.parse(saved));
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('emailProviderKeys', JSON.stringify(keys));
    onSave(keys);
    onClose();
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Email Provider Configuration</h3>
              <p className="text-sm text-slate-500 mt-1">Configure API keys for your email sending providers</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {/* Resend */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Resend</h4>
                <p className="text-xs text-slate-500">3,000 emails/month free</p>
              </div>
              <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="relative">
              <input
                type={showKeys.resend ? "text" : "password"}
                placeholder="re_..."
                value={keys.resend || ''}
                onChange={(e) => setKeys({ ...keys, resend: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('resend')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKeys.resend ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* SendGrid */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">SendGrid</h4>
                <p className="text-xs text-slate-500">100 emails/day free</p>
              </div>
              <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="relative">
              <input
                type={showKeys.sendgrid ? "text" : "password"}
                placeholder="SG...."
                value={keys.sendgrid || ''}
                onChange={(e) => setKeys({ ...keys, sendgrid: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('sendgrid')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKeys.sendgrid ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Mailgun */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Mailgun</h4>
                <p className="text-xs text-slate-500">5,000 emails/month free (3 months)</p>
              </div>
              <a href="https://app.mailgun.com/settings/api_security" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showKeys.mailgun ? "text" : "password"}
                  placeholder="API Key"
                  value={keys.mailgun?.apiKey || ''}
                  onChange={(e) => setKeys({ ...keys, mailgun: { ...keys.mailgun, apiKey: e.target.value, domain: keys.mailgun?.domain || '' } })}
                  className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('mailgun')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKeys.mailgun ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <input
                type="text"
                placeholder="Domain (e.g., mg.example.com)"
                value={keys.mailgun?.domain || ''}
                onChange={(e) => setKeys({ ...keys, mailgun: { ...keys.mailgun, apiKey: keys.mailgun?.apiKey || '', domain: e.target.value } })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
            </div>
          </div>

          {/* Brevo (Sendinblue) */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Brevo (Sendinblue)</h4>
                <p className="text-xs text-slate-500">300 emails/day free</p>
              </div>
              <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="relative">
              <input
                type={showKeys.brevo ? "text" : "password"}
                placeholder="xkeysib-..."
                value={keys.brevo || ''}
                onChange={(e) => setKeys({ ...keys, brevo: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('brevo')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKeys.brevo ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Amazon SES */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Amazon SES</h4>
                <p className="text-xs text-slate-500">62,000 emails/month free (on AWS)</p>
              </div>
              <a href="https://console.aws.amazon.com/iam/home#/security_credentials" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get Credentials →
              </a>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showKeys.ses_access ? "text" : "password"}
                  placeholder="Access Key ID"
                  value={keys.ses?.accessKeyId || ''}
                  onChange={(e) => setKeys({ ...keys, ses: { ...keys.ses, accessKeyId: e.target.value, secretAccessKey: keys.ses?.secretAccessKey || '', region: keys.ses?.region || 'us-east-1' } })}
                  className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('ses_access')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKeys.ses_access ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKeys.ses_secret ? "text" : "password"}
                  placeholder="Secret Access Key"
                  value={keys.ses?.secretAccessKey || ''}
                  onChange={(e) => setKeys({ ...keys, ses: { ...keys.ses, accessKeyId: keys.ses?.accessKeyId || '', secretAccessKey: e.target.value, region: keys.ses?.region || 'us-east-1' } })}
                  className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('ses_secret')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKeys.ses_secret ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <input
                type="text"
                placeholder="Region (e.g., us-east-1)"
                value={keys.ses?.region || ''}
                onChange={(e) => setKeys({ ...keys, ses: { ...keys.ses, accessKeyId: keys.ses?.accessKeyId || '', secretAccessKey: keys.ses?.secretAccessKey || '', region: e.target.value } })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
            </div>
          </div>

          {/* Postmark */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Postmark</h4>
                <p className="text-xs text-slate-500">$15/month for 10,000 emails</p>
              </div>
              <a href="https://account.postmarkapp.com/api_tokens" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="relative">
              <input
                type={showKeys.postmark ? "text" : "password"}
                placeholder="Server API Token"
                value={keys.postmark || ''}
                onChange={(e) => setKeys({ ...keys, postmark: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('postmark')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKeys.postmark ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Mailjet */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">Mailjet</h4>
                <p className="text-xs text-slate-500">6,000 emails/month free</p>
              </div>
              <a href="https://app.mailjet.com/account/apikeys" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showKeys.mailjet_key ? "text" : "password"}
                  placeholder="API Key"
                  value={keys.mailjet?.apiKey || ''}
                  onChange={(e) => setKeys({ ...keys, mailjet: { ...keys.mailjet, apiKey: e.target.value, apiSecret: keys.mailjet?.apiSecret || '' } })}
                  className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('mailjet_key')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKeys.mailjet_key ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKeys.mailjet_secret ? "text" : "password"}
                  placeholder="Secret Key"
                  value={keys.mailjet?.apiSecret || ''}
                  onChange={(e) => setKeys({ ...keys, mailjet: { ...keys.mailjet, apiKey: keys.mailjet?.apiKey || '', apiSecret: e.target.value } })}
                  className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
                />
                <button
                  type="button"
                  onClick={() => toggleShowKey('mailjet_secret')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKeys.mailjet_secret ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          </div>

          {/* SparkPost */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold text-slate-900">SparkPost</h4>
                <p className="text-xs text-slate-500">500 emails/month free</p>
              </div>
              <a href="https://app.sparkpost.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-700">
                Get API Key →
              </a>
            </div>
            <div className="relative">
              <input
                type={showKeys.sparkpost ? "text" : "password"}
                placeholder="API Key"
                value={keys.sparkpost || ''}
                onChange={(e) => setKeys({ ...keys, sparkpost: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 text-sm"
              />
              <button
                type="button"
                onClick={() => toggleShowKey('sparkpost')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKeys.sparkpost ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

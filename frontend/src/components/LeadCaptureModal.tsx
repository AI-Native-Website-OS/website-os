'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Send } from 'lucide-react';
import api from '@/lib/api';
import { isValidPhone, isValidEmail } from '@/lib/validators';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nProvider';

interface LeadCaptureModalProps {
  open: boolean;
  onClose: () => void;
  source: string;
  interestArea?: string;
  defaultRequirement?: string;
  /** Called after successful lead submission */
  onSuccess?: () => void;
}

export default function LeadCaptureModal({
  open,
  onClose,
  source,
  interestArea,
  defaultRequirement,
  onSuccess,
}: LeadCaptureModalProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const locked = !!user;
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (open && user) {
      setName(user.realName || user.username || '');
      setCompany(user.companyName || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
    }
  }, [open, user]);
  const [requirement, setRequirement] = useState(defaultRequirement || '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError(t('publicComp.nameRequired')); return; }
    if (!isValidPhone(phone)) { setError(t('publicComp.invalidPhone')); return; }
    if (email && !isValidEmail(email)) { setError(t('publicComp.invalidEmail')); return; }

    setLoading(true);
    try {
      const finalRequirement = requirement || defaultRequirement || interestArea || '';
      const leadData: Record<string, any> = {
        name: name.trim(),
        company: company.trim(),
        phone,
        email,
        requirement: finalRequirement,
        source,
        sourcePage: window.location.pathname,
        interestArea: interestArea || '',
      };
      const res: any = await api.post('/leads', leadData);
      if (res.code !== 200) {
        if (res.code === 400 && res.message === 'duplicate_submission') {
          setError(t('publicComp.duplicateSubmitted'));
          setLoading(false);
          return;
        }
        setError(res.message || t('publicComp.submitFailed'));
        return;
      }
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch {
      setError(t('publicComp.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">{t('publicComp.submitSuccess')}</h3>
            <p className="text-gray-500 mb-6">{t('publicComp.contactWithin24h')}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              {t('publicComp.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-black">{source === 'ai_chat' ? t('publicComp.getExclusiveSolution') : t('publicComp.leaveInfoForMaterial')}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {interestArea ? t('publicComp.followingInterest', { area: interestArea }) : t('publicComp.leaveContactForConsult')}
                </p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {locked && (
              <p className="text-xs text-gray-400 mb-4 -mt-2">{t('publicComp.loggedInLockNote')}</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.name')} <span className="text-red-400">*</span></label>
                <input
                  type="text" required value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder={t('publicComp.placeholderYourName')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.phoneWithNumber')} <span className="text-red-400">*</span></label>
                <input
                  type="tel" required value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder={t('publicComp.placeholderPhone')}
                />
                {phone && !isValidPhone(phone) && <p className="text-xs text-red-500 mt-1">{t('publicComp.invalidPhone')}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.companyName')}</label>
                <input
                  type="text" value={company}
                  onChange={e => setCompany(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder={t('publicComp.placeholderCompanyOptional')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.email')}</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder={t('publicComp.placeholderEmailOptional')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('publicComp.requirement')}</label>
                <textarea
                  rows={3} value={requirement}
                  onChange={e => setRequirement(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  placeholder={t('publicComp.requirementPlaceholder')}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? t('publicComp.submitting') : t('publicComp.submitRequirement')}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

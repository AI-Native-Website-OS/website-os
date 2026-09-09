'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Sparkles, Send } from 'lucide-react';
import api from '@/lib/api';
import { isValidPhone, isValidEmail } from '@/lib/validators';
import { useAuth } from '@/hooks/useAuth';

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

    if (!name.trim()) { setError('请输入姓名'); return; }
    if (!isValidPhone(phone)) { setError('请输入正确的11位手机号'); return; }
    if (email && !isValidEmail(email)) { setError('请输入正确的邮箱地址'); return; }

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
          setError('已提交过申请，请耐心等待管理人员联系');
          setLoading(false);
          return;
        }
        setError(res.message || '提交失败，请稍后再试');
        return;
      }
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch {
      setError('提交失败，请稍后再试');
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
            <h3 className="text-xl font-semibold text-black mb-2">提交成功！</h3>
            <p className="text-gray-500 mb-6">我们的专业顾问会在24小时内与您联系</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-black">{source === 'ai_chat' ? '获取专属方案' : '留资获取资料'}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {interestArea ? `已为您关注: ${interestArea}` : '留下联系方式，获取专属咨询'}
                </p>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {locked && (
              <p className="text-xs text-gray-400 mb-4 -mt-2">已登录：姓名/联系方式使用账号信息，不可修改，用于防止重复提交</p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名 <span className="text-red-400">*</span></label>
                <input
                  type="text" required value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="您的姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号 <span className="text-red-400">*</span></label>
                <input
                  type="tel" required value={phone}
                  onChange={e => setPhone(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="11位手机号"
                />
                {phone && !isValidPhone(phone) && <p className="text-xs text-red-500 mt-1">请输入正确的11位手机号</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司名称</label>
                <input
                  type="text" value={company}
                  onChange={e => setCompany(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="企业名称（选填）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={locked}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="邮箱（选填）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">需求描述</label>
                <textarea
                  rows={3} value={requirement}
                  onChange={e => setRequirement(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  placeholder="请简要描述您的需求..."
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? '提交中...' : '提交需求'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

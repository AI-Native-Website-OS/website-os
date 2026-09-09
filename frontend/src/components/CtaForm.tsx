'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { isValidPhone, isValidEmail } from '@/lib/validators';
import { useAuth } from '@/hooks/useAuth';

interface CtaFormProps {
  title?: string;
  subtitle?: string;
  source?: string;
  sourcePage?: string;
  open?: boolean;
  onClose?: () => void;
}

export default function CtaForm({ title = '获取专属解决方案', subtitle = '填写表单，我们的专家团队将在1个工作日内与您联系', source = 'cta-form', sourcePage, open, onClose }: CtaFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', requirement: '' });
  const locked = !!user;

  useEffect(() => {
    if (open && user) {
      setForm(prev => ({
        ...prev,
        name: user.realName || user.username || '',
        company: user.companyName || '',
        phone: user.phone || '',
        email: user.email || '',
      }));
    }
  }, [open, user]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('请输入姓名'); return; }
    if (!isValidPhone(form.phone)) { setError('请输入正确的11位手机号'); return; }
    if (form.email && !isValidEmail(form.email)) { setError('请输入正确的邮箱地址'); return; }
    setError('');
    setLoading(true);
    try {
      const res: any = await api.post('/leads', {
        name: form.name,
        company: form.company,
        phone: form.phone,
        email: form.email,
        requirement: form.requirement,
        source,
        sourcePage: sourcePage || window.location.pathname,
      });
      if (res.code !== 200) {
        if (res.code === 400 && res.message === 'duplicate_submission') {
          setError('您已在该页面提交过申请，我们将尽快与您联系；如需补充或更新需求，请通过电话或邮箱联系我们');
          setLoading(false);
          return;
        }
        setError(res.message || '提交失败，请稍后再试');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('提交失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/90 backdrop-blur-2xl rounded-2xl p-8 max-w-md w-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-black mb-2">提交成功！</h3>
            <p className="text-gray-500 mb-6">感谢您的关注，我们将尽快与您取得联系</p>
            <button onClick={handleClose} className="px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition-colors">关闭</button>
          </div>
        ) : (
          <>
<div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-black">{title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
                </div>
                <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {locked && (
                <p className="text-xs text-gray-400 mb-4 -mt-2">已登录：姓名/联系方式使用账号信息，不可修改，用于防止重复提交</p>
              )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名 <span className="text-red-400">*</span></label>
                  <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={locked}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">公司</label>
                  <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} disabled={locked}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">手机 <span className="text-red-400">*</span></label>
                  <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={locked}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500" />
                  {form.phone && !isValidPhone(form.phone) && <p className="text-xs text-red-500 mt-1">请输入正确的11位手机号</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={locked}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-50 disabled:text-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">需求描述</label>
                <textarea rows={3} value={form.requirement} onChange={(e) => setForm({ ...form, requirement: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none" />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" />
                {loading ? '提交中...' : '立即提交'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

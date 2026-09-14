'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { HelpCircle, Search } from 'lucide-react';
import api from '@/lib/api';
import type { Faq } from '@/types';
import SeoHead from '@/components/SeoHead';
import Breadcrumb from '@/components/Breadcrumb';
import { useI18n } from '@/i18n/I18nProvider';
import { generateFaqSchema } from '@/lib/seo';

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async (search?: string) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page: 1, size: 100 };
      if (search) params.keyword = search;
      const response = await api.get('/faqs', { params });
      setFaqs(response.data.records);
    } catch (error) {
      console.error('Failed to fetch faqs:', error);
    } finally {
      setLoading(false);
    }
  };

  // 输入关键词后进行服务端搜索（防抖），确保超出单页数量的 FAQ 也能被检索
  useEffect(() => {
    const t = setTimeout(() => {
      if (keyword) {
        fetchFaqs(keyword.trim());
      } else {
        fetchFaqs();
      }
    }, 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const filteredFaqs = faqs;

  return (
    <>
      <SeoHead
        title={t('faq.title')}
        description="常见问题解答：了解产品功能、服务流程、技术支持和价格方案等常见问题。"
        keywords="常见问题,FAQ,产品咨询,技术支持,服务流程"
        path="/faqs"
        breadcrumbs={[
          { name: t('common.home'), url: '/' },
          { name: t('faq.title'), url: '/faqs' },
        ]}
        additionalSchemas={faqs.length > 0 ? [generateFaqSchema(faqs.map(f => ({ question: f.question, answer: f.answer })))] : []}
      />
      <div className="bg-white min-h-screen">
        {/* Hero */}
        <section className="pt-28 pb-16 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumb items={[
              { name: t('common.home'), url: '/' },
              { name: t('faq.title'), url: '/faqs' },
            ]} />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mt-8"
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('faq.title')}</h1>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t('faq.subtitle')}</p>
            </motion.div>
          </div>
        </section>

        {/* Search */}
        <section className="sticky top-16 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 py-4">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative">
              <input
                type="text"
                placeholder={t('faq.searchPlaceholder')}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
              />
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
            </div>
          </div>
        </section>

        {/* FAQs List */}
        <section className="py-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
              </div>
            ) : filteredFaqs.length === 0 ? (
              <div className="text-center py-20 text-gray-500">{t('faq.empty')}</div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <details className="group glass border border-gray-200/60 rounded-2xl overflow-hidden transition-all duration-200">
                      <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50/50">
                        <div className="flex items-center gap-3">
                          <HelpCircle className="w-5 h-5 text-black flex-shrink-0" />
                          <span className="font-medium text-gray-900">{faq.question}</span>
                        </div>
                        <span className="ml-4 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 group-open:bg-gray-200 transition-colors">
                          <svg
                            className="w-4 h-4 text-gray-600 group-open:rotate-180 transition-transform"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </summary>
                      <div className="px-6 pb-6 text-gray-500 leading-relaxed">{faq.answer}</div>
                    </details>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-20 bg-gradient-to-b from-white to-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="section-title mb-4">{t('faq.noAnswerFound')}</h2>
            <p className="text-gray-500 mb-8 text-lg">{t('faq.contactTeam')}</p>
            <Link href="/about" className="btn-primary">{t('faq.contactUs')}</Link>
          </div>
        </section>
      </div>
    </>
  );
}

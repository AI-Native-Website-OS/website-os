'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Lightbulb, Users, Target, Award, Building2, Globe, CheckCircle, Sparkles, Mail, Phone, MapPin, Heart, Star, Send, MessageCircle, Headphones, Clock, QrCode } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import Breadcrumb from '@/components/Breadcrumb';
import { useI18n } from '@/i18n/I18nProvider';
import api from '@/lib/api';
import { AboutSection } from '@/types';
import { BlockRenderer } from '@/components/BlockRenderer';

interface CultureItem {
  title: string;
  desc: string;
}

interface Milestone {
  year: string;
  title: string;
  desc: string;
}

interface ContactItem {
  label: string;
  value: string;
  icon: string;
}
interface AboutContent {
  description: string[];
  cultureItems: CultureItem[];
  milestones: Milestone[];
  contactItems: ContactItem[];
}

const defaultContent: AboutContent = {
  description: [],
  cultureItems: [],
  milestones: [],
  contactItems: [],
};

const iconMap: Record<string, any> = {
  Phone, Mail, MapPin, Globe, Heart, Sparkles, Users, Target, Shield, Building2, Award, CheckCircle, Lightbulb, Star,
  Send, MessageCircle, Headphones, Clock, QrCode,
};

function defaultIconByType(label: string) {
  const l = (label || '').toLowerCase();
  if (/电话|手机|座机|phone/.test(l)) return Phone;
  if (/地址/.test(l)) return MapPin;
  if (/邮箱|邮件|email|mail/.test(l)) return Mail;
  if (/微信|wechat/.test(l)) return MessageCircle;
  if (/qq/.test(l)) return Send;
  if (/客服|服务热线/.test(l)) return Headphones;
  if (/时间|工作时间/.test(l)) return Clock;
  if (/二维码|qr/.test(l)) return QrCode;
  if (/公司|企业/.test(l)) return Building2;
  return Globe;
}

export default function AboutPage() {
  const [content, setContent] = useState<AboutContent>(defaultContent);
  const [dynamicSections, setDynamicSections] = useState<AboutSection[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const safeGet = (url: string) => api.get(url).catch(() => ({ data: [] }));

    Promise.all([
      safeGet('/about/sections'),
      safeGet('/contacts'),
    ]).then(([secRes, conRes]: [any, any]) => {
      const sections: AboutSection[] = secRes.data || [];
      const contacts: { type: string; value: string; icon?: string }[] = conRes.data || [];
      const result: AboutContent = { description: [], cultureItems: [], milestones: [], contactItems: [] };
      const dynamics: AboutSection[] = [];
      sections.forEach(s => {
        switch (s.sectionType) {
          case 'description':
            result.description.push(s.description || s.title || '');
            break;
          case 'culture':
            result.cultureItems.push({ title: s.title || '', desc: s.subtitle || s.description || '' });
            break;
          case 'milestone':
            result.milestones.push({ year: s.title || '', title: s.subtitle || '', desc: s.description || '' });
            break;
          case 'contact':
            result.contactItems.push({ label: s.title || '', value: s.subtitle || s.description || '', icon: s.extraData || '' });
            break;
          default:
            dynamics.push(s);
        }
      });
      contacts.forEach(c => {
        result.contactItems.push({ label: c.type, value: c.value, icon: c.icon || '' });
      });
      setContent(result);
      setDynamicSections(dynamics);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const scrollToContact = () => {
      requestAnimationFrame(() => {
        const el = document.getElementById('contact');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    if (!loading && window.location.hash === '#contact') {
      scrollToContact();
    }

    const onHashChange = () => {
      if (window.location.hash === '#contact') {
        scrollToContact();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [loading]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  const desc = content.description || [];
  const cultureItems = content.cultureItems || [];
  const milestones = content.milestones || [];
  const contactItems = content.contactItems || [];

  return (
    <>
      <SeoHead title={t('about.title')} description="" keywords="关于我们" path="/about" />
      <div className="bg-white min-h-screen">
        {/* 1. 公司介绍 */}
        <section className="pt-28 pb-24 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-[90rem] mx-auto px-6">
            <Breadcrumb items={[{ name: t('common.home'), url: '/' }, { name: t('about.title'), url: '/about' }]} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto mt-8">

              <div className="text-base text-gray-600 leading-relaxed space-y-5">
                {desc.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2. 企业文化 */}
        {cultureItems.length > 0 && (
          <section className="py-24 bg-gray-50">
            <div className="max-w-[90rem] mx-auto px-6">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
                <h2 className="section-title">{t('about.culture')}</h2>
                <p className="section-subtitle mx-auto">{t('about.cultureSubtitle')}</p>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {cultureItems.map((item, i) => {
                  const IconComp = iconMap[item.title] || Heart;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center p-8 bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-100 card-hover">
                      <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md"><IconComp className="w-6 h-6 text-white" /></div>
                      <h3 className="font-semibold text-black mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 3. 发展历程 */}
        {milestones.length > 0 && (
          <section className="py-24">
            <div className="max-w-4xl mx-auto px-6">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
                <h2 className="section-title">发展历程</h2>
                <p className="section-subtitle mx-auto">深耕行业，稳步前行</p>
              </motion.div>
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-black via-gray-300 to-transparent" />
                <div className="space-y-10">
                  {milestones.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative pl-12">
                      <div className="absolute left-2.5 top-1.5 w-3 h-3 bg-black rounded-full shadow-md" />
                      <span className="text-xs font-bold text-black bg-gray-100 px-3 py-1 rounded-full inline-block mb-1">{m.year}</span>
                      <h4 className="font-semibold text-black mt-2">{m.title}</h4>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{m.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. 新增的动态区块 */}
        {dynamicSections.map((s, i) => (
          <BlockRenderer key={s.id} section={s} index={i} />
        ))}

        {/* 5. 联系我们 */}
        {contactItems.length > 0 && (
          <section id="contact" className="py-24 bg-gray-50">
            <div className="max-w-[90rem] mx-auto px-6">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
                <h2 className="section-title">{t('about.contactTitle')}</h2>
                <p className="section-subtitle mx-auto">期待与您的沟通与合作</p>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                {contactItems.map((item, i) => {
                  const IconComp = iconMap[item.icon] || defaultIconByType(item.label);
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="text-center p-6 bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl card-hover">
                      <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center mx-auto mb-3 shadow-md"><IconComp className="w-5 h-5 text-white" /></div>
                      <h3 className="text-sm font-semibold text-black mb-1">{item.label}</h3>
                      <p className="text-sm text-gray-500 break-all">{item.value}</p>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

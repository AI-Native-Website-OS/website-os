'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Building2, FileText, MessageSquare } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nProvider';
import api from '@/lib/api';
import { detailUrl, listUrl } from '@/lib/moduleConfig';

function ProfileSection() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('publicPages.userCenter.profileTitle')}</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <User className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">{t('publicPages.userCenter.username')}</p><p className="font-medium text-gray-900">{user?.username}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <User className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">{t('publicPages.userCenter.realName')}</p><p className="font-medium text-gray-900">{user?.realName || t('publicPages.userCenter.notSet')}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <Mail className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">{t('publicPages.userCenter.email')}</p><p className="font-medium text-gray-900">{user?.email || t('publicPages.userCenter.notSet')}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <Phone className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">{t('publicPages.userCenter.phone')}</p><p className="font-medium text-gray-900">{user?.phone || t('publicPages.userCenter.notSet')}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <Building2 className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">{t('publicPages.userCenter.role')}</p><p className="font-medium text-gray-900">{user?.role === 'SUPER_ADMIN' ? t('publicPages.userCenter.roleSuperAdmin') : user?.role === 'NORMAL_USER' ? t('publicPages.userCenter.roleNormal') : t('publicPages.userCenter.roleGuest')}</p></div>
        </div>
      </div>
    </div>
  );
}

function DownloadsSection() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    api.get('/content/resources', { params: { page: 1, size: 10 } }).then(r => {
      const list = r.data?.records || [];
      setRecords(Array.isArray(list) ? list : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-2xl border border-gray-200 p-6"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-black mx-auto"></div></div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('publicPages.userCenter.downloadsTitle')}</h3>
      {records.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('publicPages.userCenter.noDownloads')}</p>
          <Link href={listUrl('resources')} className="inline-block mt-4 px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800">{t('publicPages.userCenter.browseResources')}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((wp: any) => (
            <div key={wp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-black" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{wp.title}</p>
                  <p className="text-xs text-gray-500">{wp.fileName || t('publicPages.userCenter.resourceFile')}</p>
                </div>
              </div>
              <Link href={detailUrl('resources', wp.slug)} className="text-sm text-black hover:underline">{t('publicPages.userCenter.view')}</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AiSection() {
  const { t } = useI18n();
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('publicPages.userCenter.aiTitle')}</h3>
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{t('publicPages.userCenter.aiHint')}</p>
        <Link href="/#chat" className="inline-block mt-4 px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800">{t('publicPages.userCenter.startChat')}</Link>
      </div>
    </div>
  );
}

export default function UserCenterPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <>
      <SeoHead title={t('publicPages.userCenter.seoTitle')} description="" keywords={t('publicPages.userCenter.seoKeywords')} path="/user-center" />
      <div className="bg-white min-h-screen">
        <div className="max-w-[90rem] mx-auto px-6 pt-20 pb-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-black">{t('publicPages.userCenter.title')}</h1>
            <ProfileSection />
            <DownloadsSection />
            <AiSection />
          </div>
        </div>
      </div>
    </>
  );
}

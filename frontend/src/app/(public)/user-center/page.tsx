'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Building2, FileText, MessageSquare } from 'lucide-react';
import SeoHead from '@/components/SeoHead';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { detailUrl, listUrl } from '@/lib/moduleConfig';

function ProfileSection() {
  const { user } = useAuth();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">个人信息</h3>
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <User className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">用户名</p><p className="font-medium text-gray-900">{user?.username}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <User className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">姓名</p><p className="font-medium text-gray-900">{user?.realName || '未设置'}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <Mail className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">邮箱</p><p className="font-medium text-gray-900">{user?.email || '未设置'}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <Phone className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">手机</p><p className="font-medium text-gray-900">{user?.phone || '未设置'}</p></div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <Building2 className="w-5 h-5 text-black" />
          <div><p className="text-sm text-gray-500">角色</p><p className="font-medium text-gray-900">{user?.role === 'SUPER_ADMIN' ? '超级管理员' : user?.role === 'NORMAL_USER' ? '普通用户' : '游客'}</p></div>
        </div>
      </div>
    </div>
  );
}

function DownloadsSection() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/content/resources', { params: { page: 1, size: 10 } }).then(r => {
      const list = r.data?.records || [];
      setRecords(Array.isArray(list) ? list : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white rounded-2xl border border-gray-200 p-6"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-black mx-auto"></div></div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">资源下载</h3>
      {records.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">暂无下载记录</p>
          <Link href={listUrl('resources')} className="inline-block mt-4 px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800">浏览资源</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((wp: any) => (
            <div key={wp.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-black" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{wp.title}</p>
                  <p className="text-xs text-gray-500">{wp.fileName || '资源文件'}</p>
                </div>
              </div>
              <Link href={detailUrl('resources', wp.slug)} className="text-sm text-black hover:underline">查看</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AiSection() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">AI顾问</h3>
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">您可以通过首页AI顾问进行在线咨询</p>
        <Link href="/#chat" className="inline-block mt-4 px-4 py-2 bg-black text-white rounded-full text-sm hover:bg-gray-800">开始咨询</Link>
      </div>
    </div>
  );
}

export default function UserCenterPage() {
  const { user } = useAuth();

  return (
    <>
      <SeoHead title="用户中心" description="圣诺联合用户中心" keywords="用户中心" path="/user-center" />
      <div className="bg-white min-h-screen">
        <div className="max-w-[90rem] mx-auto px-6 pt-20 pb-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-black">用户中心</h1>
            <ProfileSection />
            <DownloadsSection />
            <AiSection />
          </div>
        </div>
      </div>
    </>
  );
}

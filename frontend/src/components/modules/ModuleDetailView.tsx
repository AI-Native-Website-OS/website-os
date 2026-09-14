'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Calendar, FileText, User, Eye, Tag, Download,
} from 'lucide-react';
import api from '@/lib/api';
import type { ContentItem, ContentRelations, CoreModule } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useSiteConfig } from '@/hooks/useSiteConfig';
import SeoHead from '@/components/SeoHead';
import Breadcrumb from '@/components/Breadcrumb';
import FilePreview from '@/components/FilePreview';
import TocNav from '@/components/TocNav';
import CtaForm from '@/components/CtaForm';
import PageState from '@/components/PageState';
import { BlockContent } from '@/components/BlockContent';
import { parseContentSections, type SectionEntry } from '@/lib/blockData';
import CrossRecommend from '@/components/CrossRecommend';
import { getImageUrl, getFileUrl, formatDate, parseCoverScale } from '@/lib/utils';
import { generateArticleSchema, toSiteIdentity } from '@/lib/seo';
import { detailUrl, nestedDetailUrl, listUrl, categoryUrl } from '@/lib/moduleConfig';
import { loadModule } from '@/lib/moduleLoader';

const loginPromptStyles = {
  wrapper: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4',
  card: 'bg-white rounded-2xl p-8 max-w-md w-full shadow-xl',
};

const LIST_LABELS: Record<string, string> = {
  products: '产品中心',
  solutions: '解决方案',
  cases: '客户案例',
  resources: '资源中心',
};

function renderSections(sections: SectionEntry[], htmlFallback?: string) {
  const items = sections.map((s, i) => (
    <div key={i}>
      <BlockContent type={s.sectionType} data={s.data} />
    </div>
  ));
  if (items.length === 0 && htmlFallback) {
    return (
      <div className="prose prose-gray max-w-none">
        <div dangerouslySetInnerHTML={{ __html: htmlFallback }} />
      </div>
    );
  }
  return items;
}

export function ModuleDetailView({ moduleKey, slug, categorySlug }: { moduleKey: string; slug: string; categorySlug?: string }) {
  const [moduleMeta, setModuleMeta] = useState<CoreModule | null>(null);
  const [resolvedKey, setResolvedKey] = useState(moduleKey);
  const [item, setItem] = useState<ContentItem | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [related, setRelated] = useState<ContentItem[]>([]);
  const [relations, setRelations] = useState<ContentRelations>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [showCta, setShowCta] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const { user } = useAuth();
  const { siteConfig } = useSiteConfig();
  const site = toSiteIdentity(siteConfig);
  const router = useRouter();

  useEffect(() => {
    loadModule(moduleKey).then((m) => {
      if (m) {
        setModuleMeta(m);
        setResolvedKey(m.moduleKey);
      }
    });
  }, [moduleKey]);

  useEffect(() => {
    if (!slug) {
      setError('参数错误');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setItem(null);
      setRelated([]);
      setRelations({});
      setCategoryName('');
      try {
        const response = await api.get(`/content/${moduleKey}/${slug}`);
        const data: ContentItem = response.data;
        setItem(data);
        setResolvedKey(moduleKey);

        if (data.categoryId) {
          try {
            const catRes = await api.get(`/content/${moduleKey}/categories`);
            const cats: Array<{ id: number; name: string }> = catRes.data || [];
            const found = cats.find((c) => c.id === data.categoryId);
            if (found) setCategoryName(found.name);
          } catch { /* ignore */ }
        }

        try {
          const relatedResponse = await api.get(`/content/${moduleKey}`, {
            params: { page: 1, size: 3 },
          });
          setRelated((relatedResponse.data.records || []).filter((a: ContentItem) => a.id !== data.id));
        } catch { /* ignore */ }

        try {
          const relationsResponse = await api.get('/content/relations', {
            params: { moduleKey, slug },
          });
          setRelations(relationsResponse.data || {});
        } catch { /* ignore */ }
      } catch {
        setError('内容不存在或加载失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [moduleKey, slug]);

  useEffect(() => {
    if (item) {
      document.title = site.name ? `${item.title} - ${site.name}` : item.title;
    }
  }, [item]);

  const requireAuth = (action: () => void) => {
    if (!user) {
      setShowLoginPrompt(true);
    } else {
      action();
    }
  };

  const loginPrompt = (
    <div className={loginPromptStyles.wrapper} onClick={() => setShowLoginPrompt(false)}>
      <div className={loginPromptStyles.card} onClick={e => e.stopPropagation()}>
        <div className="text-center py-6">
          <p className="text-gray-700 mb-6">请先注册或登录后，再获取内容</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/login')} className="px-5 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">去登录</button>
            <button onClick={() => setShowLoginPrompt(false)} className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">稍后再说</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) return <PageState loading />;
  if (error) return <PageState error={error} />;
  if (!item) return <PageState error="内容不存在" />;

  const listPath = categorySlug ? categoryUrl(resolvedKey, categorySlug) : listUrl(resolvedKey);
  const currentUrl = categorySlug ? nestedDetailUrl(resolvedKey, categorySlug, slug) : detailUrl(resolvedKey, slug);
  const listLabel = moduleMeta?.moduleName || LIST_LABELS[resolvedKey] || '内容中心';

  const crumbs = [
    { name: '首页', url: '/' },
    { name: listLabel, url: listPath },
    { name: item.title || '', url: currentUrl },
  ];

  const sections = parseContentSections(item.extraData);
  const htmlFallback = item.content || '';
  const tag = moduleMeta?.moduleType === 2 ? '' : (categoryName || item.groupName || '');
  const relationsActive = Object.values(relations || {}).some((items) => items && items.length > 0);
  const { width: coverWidth, height: coverHeight } = parseCoverScale(item.coverScale);
  const handleDownload = () => {
    if (item.filePath) window.open(getFileUrl(item.filePath), '_blank');
  };

  return (
    <>
      <SeoHead
        title={item.seoTitle || item.title}
        description={item.seoDescription || item.summary}
        keywords={`${item.title},${tag}`}
        path={currentUrl}
        pageId={item.id}
        ogType="article"
        ogImage={getImageUrl(item.coverImage)}
        breadcrumbs={crumbs}
        additionalSchemas={[
          generateArticleSchema({
            title: item.title, description: item.summary || '', content: item.content || '',
            image: getImageUrl(item.coverImage), slug: item.slug, author: item.author || '',
            publishedAt: item.publishedAt ?? '', category: categoryName,
          }, site),
        ]}
      />
      <div className="bg-white min-h-screen">
        {item.coverImage ? (
          <div className="relative w-full bg-white">
            <div className="relative w-full mx-auto" style={{ maxWidth: coverWidth }}>
              <img
                src={getImageUrl(item.coverImage)}
                alt={item.title}
                width={coverWidth}
                height={coverHeight}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white to-transparent" />
              <div className="absolute inset-0 max-w-[90rem] mx-auto px-6 flex flex-col">
                <div className="pt-20">
                  <Breadcrumb items={crumbs} light />
                </div>
                <div className="mt-auto pb-8 md:pb-10">
                  <Link href={listPath} className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" />返回{listLabel}
                  </Link>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-3 max-w-3xl">
                    {(tag || item.publishedAt || item.author || item.viewCount != null) && (
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        {tag && (
                          <span className="inline-block px-3 py-1 bg-white/15 text-white text-sm rounded-full backdrop-blur-sm">{tag}</span>
                        )}
                        {item.publishedAt && (
                          <span className="flex items-center gap-1 text-sm text-white/70">
                            <Calendar className="w-3.5 h-3.5" />{formatDate(item.publishedAt)}
                          </span>
                        )}
                        {item.author && (
                          <span className="flex items-center gap-1 text-sm text-white/70">
                            <User className="w-3.5 h-3.5" />{item.author}
                          </span>
                        )}
                        {item.viewCount != null && (
                          <span className="flex items-center gap-1 text-sm text-white/70">
                            <Eye className="w-3.5 h-3.5" />{item.viewCount} 次阅读
                          </span>
                        )}
                      </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-semibold text-white leading-tight">{item.title}</h1>
                    {item.summary && <p className="text-lg text-white/80 mt-3 leading-relaxed line-clamp-2">{item.summary}</p>}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[90rem] mx-auto px-6 pt-20">
            <Breadcrumb items={crumbs} />
          </div>
        )}
        <article className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {!item.coverImage && (
            <Link href={listPath} className="inline-flex items-center gap-2 text-gray-500 hover:text-black mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />返回{listLabel}
            </Link>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-12 items-start">
            <div className="min-w-0">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {!item.coverImage && (
                  <>
                    {(tag || item.publishedAt || item.author || item.viewCount != null) && (
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        {tag && (
                          <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{tag}</span>
                        )}
                        {item.publishedAt && (
                          <span className="flex items-center gap-1 text-sm text-gray-400">
                            <Calendar className="w-3.5 h-3.5" />{formatDate(item.publishedAt)}
                          </span>
                        )}
                        {item.author && (
                          <span className="flex items-center gap-1 text-sm text-gray-400">
                            <User className="w-3.5 h-3.5" />{item.author}
                          </span>
                        )}
                        {item.viewCount != null && (
                          <span className="flex items-center gap-1 text-sm text-gray-400">
                            <Eye className="w-3.5 h-3.5" />{item.viewCount} 次阅读
                          </span>
                        )}
                      </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-semibold text-black mb-4 leading-tight">{item.title}</h1>
                    {item.summary && <p className="text-lg text-gray-500 mb-8 leading-relaxed">{item.summary}</p>}
                  </>
                )}
                <div className="space-y-10">
                  {renderSections(sections, htmlFallback)}
                </div>
                {item.source && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <span className="flex items-center gap-1 text-sm text-gray-400">
                      <Tag className="w-3.5 h-3.5" />来源：{item.source}
                    </span>
                  </div>
                )}
                {item.filePath && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <button onClick={() => requireAuth(() => setPreviewFile({ url: getFileUrl(item.filePath!), name: item.fileName || item.filePath?.split('/').pop() || '' }))} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-900 rounded-full font-medium hover:border-gray-400 transition-colors text-sm">
                        <FileText className="w-4 h-4" />在线预览
                      </button>
                      <button onClick={() => requireAuth(handleDownload)} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors text-sm">
                        <Download className="w-4 h-4" />下载资料
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>

              <div className="mt-12">
                <TocNav content={htmlFallback} />
              </div>
            </div>

            <aside className="min-w-0">
            {relationsActive ? (
              <div className="lg:sticky lg:top-24">
                <CrossRecommend relations={relations} variant="sidebar" />
              </div>
            ) : related.length > 0 && (
              <div className="lg:sticky lg:top-24 space-y-6">
                <h2 className="text-xl font-semibold text-black">相关{moduleMeta?.moduleName || '内容'}</h2>
                <div className="space-y-4">
                  {related.map((rel, index) => (
                    <motion.div key={rel.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                      <Link href={detailUrl(resolvedKey, rel.slug)} className="block p-5 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                        {rel.coverImage && (
                          <img src={getImageUrl(rel.coverImage)} alt={rel.title} className="w-full h-32 object-cover rounded-lg mb-3" />
                        )}
                        <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{rel.title}</p>
                        <p className="text-xs text-gray-400">{formatDate(rel.publishedAt ?? rel.createdAt ?? '')}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </aside>
          </div>
        </article>

        <section className="bg-gray-50 py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-semibold text-black mb-4">需要更多帮助？</h2>
            <p className="text-gray-500 mb-8">我们的专家团队随时为您提供专业的咨询和建议</p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setShowCta(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors">联系咨询</button>
            </div>
          </div>
        </section>
      </div>
      <CtaForm title="咨询详情" subtitle="填写表单，我们的专家团队将尽快与您联系" source="content-cta" sourcePage={item.title} open={showCta} onClose={() => setShowCta(false)} />
      {previewFile && <FilePreview fileUrl={previewFile.url} fileName={previewFile.name} onClose={() => setPreviewFile(null)} />}
      {showLoginPrompt && loginPrompt}
    </>
  );
}

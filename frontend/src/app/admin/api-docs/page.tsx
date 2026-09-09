'use client';

import { useEffect, useRef } from 'react';
import config from '@/config';
import { useI18n } from '@/i18n/I18nProvider';

declare global {
  interface Window {
    SwaggerUIBundle: any;
  }
}

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const loadSwaggerUi = () => {
      if (!containerRef.current) return;
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      new window.SwaggerUIBundle({
        url: `${config.api.baseUrl}/v3/api-docs`,
        dom_id: '#swagger-ui-container',
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        requestInterceptor: (req: any) => {
          if (token) {
            req.headers.Authorization = `Bearer ${token}`;
          }
          return req;
        },
      });
    };

    if (window.SwaggerUIBundle) {
      loadSwaggerUi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js';
      script.async = true;
      script.onload = loadSwaggerUi;
      document.head.appendChild(script);

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
      document.head.appendChild(link);
    }

    return () => {
      const script = document.querySelector(
        'script[src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"]'
      );
      if (script) script.remove();
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{t('admin.page.apiDocs')}</h1>
        <p className="text-sm text-gray-500">{t('admin.ui.apiDocs.subtitle')}</p>
      </div>
      <div
        ref={containerRef}
        id="swagger-ui-container"
        className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        style={{ minHeight: '70vh' }}
      />
    </div>
  );
}

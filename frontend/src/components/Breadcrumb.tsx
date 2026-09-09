import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbItem } from '@/lib/seo';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  light?: boolean;
}

export default function Breadcrumb({ items, light = false }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="py-3">
      <ol className={`flex items-center gap-1.5 text-sm ${light ? 'text-white/70' : 'text-gray-500'}`}>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className={`w-3.5 h-3.5 ${light ? 'text-white/40' : 'text-gray-400'}`} />}
            {index === items.length - 1 ? (
              <span className={`font-medium ${light ? 'text-white' : 'text-black'}`} aria-current="page">{item.name}</span>
            ) : (
              <Link href={item.url} className={`transition-colors ${light ? 'hover:text-white' : 'hover:text-black'}`}>
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

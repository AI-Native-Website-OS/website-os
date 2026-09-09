'use client';

import { motion } from 'framer-motion';
import { parseBlockExtraData } from '@/lib/blockData';
import { BlockContent } from './BlockContent';

interface BlockRendererProps {
  section: { sectionType: string; title: string; subtitle: string; extraData?: string };
  index?: number;
}

export function BlockRenderer({ section, index = 0 }: BlockRendererProps) {
  const { data } = parseBlockExtraData(section.extraData);
  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';

  const renderHeader = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="section-header">
      {section.title && <h2 className="section-title">{section.title}</h2>}
      {section.subtitle && <p className="section-subtitle mx-auto">{section.subtitle}</p>}
    </motion.div>
  );

  return (
    <section className={`py-12 ${bg}`}>
      <div className="max-w-[95rem] mx-auto px-6">
        {renderHeader()}
        <BlockContent type={section.sectionType} data={data} />
      </div>
    </section>
  );
}
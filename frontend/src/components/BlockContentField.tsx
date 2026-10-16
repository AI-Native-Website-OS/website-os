'use client';

import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { blockTypes } from '@/lib/blockData';
import { parseBlockExtraData, serializeBlockData, getRecordSectionType, validateBlockTypeData } from '@/lib/blockData';
import BlockTypeEditor from './BlockTypeEditor';
import RichTextEditor from './RichTextEditor';
import { useI18n } from '@/i18n/I18nProvider';

export interface BlockContentFieldHandle {
  validate: () => boolean;
  getExtraData: () => string;
}

interface Props {
  item?: { extraData?: string } | null;
}

/**
 * 展示类型选择 + 按类型编辑内容体，序列化为 extraData（含 sectionType）。
 * 供产品/方案/案例/资源弹窗复用（与内容中心 ContentForm 的区块逻辑一致）。
 */
const BlockContentField = forwardRef<BlockContentFieldHandle, Props>(function BlockContentField({ item }, ref) {
  const { t } = useI18n();
  const [sectionType, setSectionType] = useState<string>(getRecordSectionType(item));
  const [blockData, setBlockData] = useState<any>(parseBlockExtraData(item?.extraData).data || {});
  const [blockErrors, setBlockErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSectionType(getRecordSectionType(item));
    setBlockData(parseBlockExtraData(item?.extraData).data || {});
    setBlockErrors({});
  }, [item]);

  const updateBlockData = (key: string, val: any) => setBlockData((prev: any) => ({ ...prev, [key]: val }));

  const handleTypeChange = (newType: string) => {
    setSectionType(newType);
    setBlockData({});
    setBlockErrors({});
  };

  useImperativeHandle(ref, () => ({
    validate() {
      const errs = validateBlockTypeData(sectionType, blockData);
      setBlockErrors(errs);
      return Object.keys(errs).length === 0;
    },
    getExtraData() {
      return serializeBlockData(blockData, sectionType);
    },
  }), [sectionType, blockData]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminComp.blockForm.displayType')} <span className="text-red-400">*</span></label>
      <select value={sectionType} onChange={(e) => handleTypeChange(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white">
        {blockTypes().map((bt) => <option key={bt.type} value={bt.type}>{bt.label} — {bt.desc}</option>)}
      </select>
      <p className="text-xs text-gray-400 mt-1">{t('adminComp.blockContentField.hint')}</p>
      <div className="mt-3">
        {sectionType === 'rich_text' ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminComp.blockContentField.body')}</label>
            <RichTextEditor value={blockData.content || ''} onChange={(v) => updateBlockData('content', v)} placeholder={t('adminComp.blockContentField.bodyPlaceholder')} />
          </>
        ) : (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
            <BlockTypeEditor type={sectionType} data={blockData} errors={blockErrors} updateData={updateBlockData} />
          </div>
        )}
      </div>
    </div>
  );
});

export default BlockContentField;
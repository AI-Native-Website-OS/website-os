import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, fireEvent, waitFor, cleanup, screen } from '@testing-library/react';
import RelatedContentMultiPicker, { type RelatedTarget } from './RelatedContentMultiPicker';

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
}));

import api from '@/lib/api';

const targets: RelatedTarget[] = [
  { field: 'product', type: 'product', label: '产品' },
];

const mockItems = [
  { id: 11, title: '产品A', slug: 'product-a', summary: '', coverImage: '', type: 'product' },
];

function Wrapper({ initial = {} }: { initial?: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  return <RelatedContentMultiPicker targets={targets} values={values} onChange={setValues} />;
}

describe('RelatedContentMultiPicker', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/admin/related-content/list') {
        return Promise.resolve({ data: { total: 1, pages: 1, records: mockItems } });
      }
      if (url === '/admin/related-content/batch') {
        return Promise.resolve({ data: mockItems });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it('renders selected tags after confirm without reopening the picker', async () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText('未选择'));
    await waitFor(() => expect(screen.getByText('产品A')).toBeInTheDocument());

    fireEvent.click(screen.getByText('产品A'));
    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => expect(screen.getByText('产品A')).toBeInTheDocument());
  });

  it('renders existing tags on mount when values already contain ids', async () => {
    render(<Wrapper initial={{ product: '11' }} />);

    await waitFor(() => expect(screen.getByText('产品A')).toBeInTheDocument());
  });
});
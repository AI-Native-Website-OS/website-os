import { describe, it, expect } from 'vitest';
import { buildVhFixedDoc, VH_FIX_SCRIPT } from './HtmlBlockView';

describe('buildVhFixedDoc', () => {
  it('appends the vh-fix script to a fragment', () => {
    const out = buildVhFixedDoc('<div>hi</div>');
    expect(out).toBe('<div>hi</div>' + `<script>${VH_FIX_SCRIPT}</script>`);
  });

  it('injects the vh-fix script before </body> in a full document', () => {
    const html = '<html><head><style>.hero{min-height:92vh}</style></head><body><div>x</div></body></html>';
    const out = buildVhFixedDoc(html);
    expect(out.indexOf(`<script>${VH_FIX_SCRIPT}</script>`)).toBeGreaterThan(out.indexOf('<body>'));
    expect(out.indexOf('</body>')).toBeGreaterThan(out.indexOf(`<script>${VH_FIX_SCRIPT}</script>`));
    expect(out).toContain('.hero{min-height:92vh}');
  });

  it('injects the vh-fix script before </html> when there is no </body>', () => {
    const html = '<html><body><div>x</div></html>';
    const out = buildVhFixedDoc(html);
    expect(out.indexOf(`<script>${VH_FIX_SCRIPT}</script>`)).toBeGreaterThan(out.indexOf('<body>'));
    expect(out.indexOf('</html>')).toBeGreaterThan(out.indexOf(`<script>${VH_FIX_SCRIPT}</script>`));
  });
});
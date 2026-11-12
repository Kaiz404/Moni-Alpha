import { glyphOn } from '../glyph-on';

describe('glyphOn', () => {
  it('puts a light glyph on dark fills', () => {
    expect(glyphOn('#236B47')).toBe('#F6F3ED');
    expect(glyphOn('#17181A')).toBe('#F6F3ED');
  });

  it('keeps the near-black glyph on light and mid fills', () => {
    expect(glyphOn('#FFFFFF')).toBe('#17181A');
    expect(glyphOn('#F6F3ED')).toBe('#17181A');
    expect(glyphOn('#F4A582')).toBe('#17181A');
  });
});

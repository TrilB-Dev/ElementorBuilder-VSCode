type ElementorIconEntry = {
  css?: string;
  search?: string[];
  path?: string;
  width?: number;
  height?: number;
};

type ElementorIconManifest = {
  glyphs?: Array<ElementorIconEntry>;
  [key: string]: unknown;
};

const iconConfigManifest = (() => {
  try {
    return require('./assets/elementor-icons-5.53.0/config.json') as ElementorIconManifest;
  } catch {
    return require('../../src/webview/assets/elementor-icons-5.53.0/config.json') as ElementorIconManifest;
  }
})();

const svgFallbackManifest = (() => {
  try {
    return require('./assets/elementor-icons-5.53.0/eicons.json') as Record<string, unknown>;
  } catch {
    return require('../../src/webview/assets/elementor-icons-5.53.0/eicons.json') as Record<string, unknown>;
  }
})();

const getManifestGlyphs = (): Array<ElementorIconEntry> => {
  if (Array.isArray(iconConfigManifest?.glyphs) && iconConfigManifest.glyphs.length > 0) {
    return iconConfigManifest.glyphs;
  }

  if (iconConfigManifest && typeof iconConfigManifest === 'object' && Array.isArray((iconConfigManifest as { glyphs?: unknown[] }).glyphs)) {
    return (iconConfigManifest as { glyphs: Array<ElementorIconEntry> }).glyphs;
  }

  if (svgFallbackManifest && typeof svgFallbackManifest === 'object') {
    return Object.entries(svgFallbackManifest)
      .filter(([key, value]) => key && typeof value === 'object' && value !== null)
      .map(([key, value]) => ({
        css: typeof (value as { css?: string })?.css === 'string'
          ? (value as { css?: string }).css
          : key,
        search: Array.isArray((value as { search?: string[] })?.search)
          ? (value as { search?: string[] }).search ?? []
          : [],
        ...(value as Record<string, unknown>)
      }));
  }

  return [];
};

export const ELEMENTOR_ICON_PREFIX = 'eicon-';

export const normalizeElementorIconClass = (value: string): string => {
  const rawValue = (value ?? '').trim();

  if (!rawValue) {
    return `${ELEMENTOR_ICON_PREFIX}text`;
  }

  const trimmedValue = rawValue.replace(/^\./, '').trim();

  if (!trimmedValue) {
    return `${ELEMENTOR_ICON_PREFIX}text`;
  }

  const normalized = trimmedValue.startsWith(ELEMENTOR_ICON_PREFIX)
    ? trimmedValue
    : trimmedValue.startsWith('icon-')
      ? `${ELEMENTOR_ICON_PREFIX}${trimmedValue.slice('icon-'.length)}`
      : `${ELEMENTOR_ICON_PREFIX}${trimmedValue.replace(/^eicon-?/i, '')}`;

  return normalized;
};

export const getElementorIconOptions = (): string[] => {
  const glyphs = getManifestGlyphs();

  return Array.from(new Set(
    glyphs
      .map((glyph) => {
        const name = typeof glyph?.css === 'string' ? glyph.css.trim() : '';
        return name ? normalizeElementorIconClass(name) : '';
      })
      .filter((value): value is string => Boolean(value))
  ));
};

export const getElementorIconSearchTerms = (value: string): string[] => {
  const normalized = normalizeElementorIconClass(value);
  const glyphs = getManifestGlyphs();
  const match = glyphs.find((glyph) => normalizeElementorIconClass(String(glyph.css ?? '')) === normalized);

  const terms = match?.search && match.search.length > 0
    ? match.search.map((entry) => entry.toLowerCase())
    : [normalized.replace(ELEMENTOR_ICON_PREFIX, '').toLowerCase()];

  return Array.from(new Set(terms.filter(Boolean)));
};

export type PreviewUrlBuildResult = {
  previewUrl: string;
  source: 'configured-base-url' | 'host-ip';
  ignoredPath: boolean;
  invalidBaseUrl: boolean;
};

const normalizePort = (value?: number | null): number | null => {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.floor(value);
};

const normalizeHost = (value?: string | null): string | null => {
  if (!value?.trim()) {
    return null;
  }

  const normalized = value.trim();
  return normalized.includes(':') && !normalized.startsWith('[')
    ? `[${normalized}]`
    : normalized;
};

const resolveConfiguredPreviewBase = (
  rawValue?: string | null,
): {
  protocol: 'http:' | 'https:';
  host: string;
  ignoredPath: boolean;
} | null => {
  if (!rawValue?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(rawValue.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const host = normalizeHost(parsed.hostname);
    if (!host) {
      return null;
    }

    return {
      protocol: parsed.protocol,
      host,
      ignoredPath:
        parsed.pathname !== '/' ||
        parsed.search.length > 0 ||
        parsed.hash.length > 0,
    };
  } catch {
    return null;
  }
};

export const buildPreviewUrl = (params: {
  previewBaseUrl?: string | null;
  hostIp?: string | null;
  hostPort?: number | null;
  previewPath?: string | null;
}): PreviewUrlBuildResult | null => {
  const port = normalizePort(params.hostPort);
  if (!port) {
    return null;
  }

  const previewPath =
    typeof params.previewPath === 'string' && params.previewPath.trim()
      ? normalizePreviewPath(params.previewPath)
      : null;

  const normalizedPreviewBase = resolveConfiguredPreviewBase(
    params.previewBaseUrl,
  );
  if (normalizedPreviewBase) {
    const externalUrl = appendPreviewPath(
      `${normalizedPreviewBase.protocol}//${normalizedPreviewBase.host}:${port}`,
      previewPath,
    );
    return {
      previewUrl: externalUrl,
      source: 'configured-base-url',
      ignoredPath: normalizedPreviewBase.ignoredPath,
      invalidBaseUrl: false,
    };
  }

  const host = normalizeHost(params.hostIp);
  if (!host) {
    return null;
  }

  return {
    previewUrl: appendPreviewPath(`http://${host}:${port}`, previewPath),
    source: 'host-ip',
    ignoredPath: false,
    invalidBaseUrl: Boolean(params.previewBaseUrl?.trim()),
  };
};

const normalizePreviewPath = (value: string): string => {
  const normalized = value.trim();
  if (!normalized || normalized === '/') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const appendPreviewPath = (baseUrl: string, previewPath: string | null) => {
  if (!previewPath || previewPath === '/') {
    return baseUrl;
  }

  return `${baseUrl}${previewPath}`;
};

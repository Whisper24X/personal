import { buildPreviewUrl } from './preview-url';

describe('buildPreviewUrl', () => {
  it('should build an external preview url from the configured preview base url', () => {
    expect(
      buildPreviewUrl({
        previewBaseUrl: 'https://preview.example.com/workspace/',
        hostIp: '127.0.0.1',
        hostPort: 38080,
      }),
    ).toEqual({
      previewAddress: 'https://preview.example.com:38080',
      baseUrl: 'https://preview.example.com:38080',
      source: 'configured-base-url',
      ignoredPath: true,
      invalidBaseUrl: false,
    });
  });

  it('should fall back to the host ip when the preview base url is invalid', () => {
    expect(
      buildPreviewUrl({
        previewBaseUrl: 'preview.example.com',
        hostIp: '192.168.1.9',
        hostPort: 38123,
      }),
    ).toEqual({
      previewAddress: '192.168.1.9:38123',
      baseUrl: 'http://192.168.1.9:38123',
      source: 'host-ip',
      ignoredPath: false,
      invalidBaseUrl: true,
    });
  });

  it('should fall back to host ip preview url when no preview base url is configured', () => {
    expect(
      buildPreviewUrl({
        hostIp: '192.168.1.9',
        hostPort: 38123,
      }),
    ).toEqual({
      previewAddress: '192.168.1.9:38123',
      baseUrl: 'http://192.168.1.9:38123',
      source: 'host-ip',
      ignoredPath: false,
      invalidBaseUrl: false,
    });
  });
});

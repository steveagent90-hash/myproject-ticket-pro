import QRCode from 'qrcode';

export interface QrCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export async function generateQRCode(data: string, options: QrCodeOptions = {}): Promise<string> {
  const opts = {
    width: options.width ?? 256,
    margin: options.margin ?? 2,
    color: {
      dark: options.color?.dark ?? '#000000',
      light: options.color?.light ?? '#ffffff',
    },
  };
  return await QRCode.toDataURL(data, opts);
}

export async function generateQRCodeCanvas(
  data: string,
  width: number = 256
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, data, { width });
  return canvas;
}

export function extractTokenFromScanData(data: string): string {
  if (data.startsWith('http://') || data.startsWith('https://')) {
    try {
      const url = new URL(data);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'e' && pathParts[1]) {
        return decodeURIComponent(pathParts.slice(1).join('/'));
      }
    } catch {
      // Fall through to return original data
    }
  }
  return data;
}

export function buildPublicEventUrl(token: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/e/${encodeURIComponent(token)}`;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (appUrl) {
    return `${appUrl}/e/${encodeURIComponent(token)}`;
  }
  return `/e/${encodeURIComponent(token)}`;
}

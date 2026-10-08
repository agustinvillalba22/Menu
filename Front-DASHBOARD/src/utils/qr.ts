import QRCode from 'qrcode';

/**
 * Generates a data URL (image/png) for a given string or URL.
 */
export async function generateQRDataURL(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 400,
      margin: 2,
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL', err);
    return '';
  }
}

/**
 * Generates an SVG string for a given text or URL.
 */
export async function generateQRSVG(text: string): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR SVG', err);
    return '';
  }
}

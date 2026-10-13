// Optical Air-Gap & QR Code Mesh Service
// Allows 100% air-gapped offline peer-to-peer messaging using animated QR optical data transfer
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { DeliveryMethod } from '../types';

export interface OpticalMessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: string;
  timestamp: number;
}

export class OpticalMeshService {
  // Generate a high-density QR code Data URL for an offline message packet
  public static async generateQR(payload: OpticalMessagePayload): Promise<string> {
    try {
      const dataStr = JSON.stringify({
        v: 1,
        src: 'offgrid',
        ...payload
      });
      return await QRCode.toDataURL(dataStr, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#111b21',
          light: '#ffffff',
        }
      });
    } catch (err) {
      console.error('Failed to generate optical QR code:', err);
      throw err;
    }
  }

  // Scan video frame using jsQR
  public static scanFrame(videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement): OpticalMessagePayload | null {
    if (videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
      return null;
    }

    const canvas = canvasElement;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      try {
        const parsed = JSON.parse(code.data);
        if (parsed.src === 'offgrid' && parsed.text && parsed.senderId) {
          return {
            id: parsed.id,
            conversationId: parsed.conversationId,
            senderId: parsed.senderId,
            senderName: parsed.senderName || 'Par Óptico',
            text: parsed.text,
            type: parsed.type || 'text',
            timestamp: parsed.timestamp || Date.now(),
          };
        }
      } catch {
        // Not an offgrid optical payload
      }
    }
    return null;
  }
}

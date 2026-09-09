import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.resolve(__dirname, '..', '.whatsapp_auth');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
    this.qrCode = null; // data:image/png;base64,...
    this.userPhone = null;
    this.userName = null;
    this.isInitializing = false;
    this.reconnectTimeout = null;
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      this.status = 'connecting';
      this.qrCode = null;

      const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['PEELA VFX Tracker', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 6,
              color: {
                dark: '#000000',
                light: '#ffffff',
              },
            });
            this.status = 'qr_ready';
            console.log('[WhatsApp] New QR code generated for web login.');
          } catch (err) {
            console.error('[WhatsApp] Error generating QR code image:', err);
          }
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrCode = null;
          const rawId = sock.user?.id || '';
          this.userPhone = rawId.split(':')[0].replace(/\D/g, '') || null;
          this.userName = sock.user?.name || null;
          console.log(`[WhatsApp] Connected successfully as +${this.userPhone} (${this.userName || 'User'})`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

          this.status = 'disconnected';
          this.userPhone = null;
          this.userName = null;
          this.qrCode = null;
          this.sock = null;

          if (shouldReconnect) {
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              this.isInitializing = false;
              this.init();
            }, 3000);
          } else {
            console.log('[WhatsApp] Device logged out. Cleaning session credentials.');
            this.cleanAuthDir();
          }
        }
      });
    } catch (err) {
      console.error('[WhatsApp] Initialization error:', err);
      this.status = 'disconnected';
    } finally {
      this.isInitializing = false;
    }
  }

  cleanAuthDir() {
    try {
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[WhatsApp] Error cleaning auth directory:', err);
    }
  }

  getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      userPhone: this.userPhone,
      userName: this.userName,
    };
  }

  async sendMessage(phone, message) {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp is not connected. Please scan the QR code first.');
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (!cleanPhone) {
      throw new Error('Invalid recipient phone number.');
    }

    const jid = `${cleanPhone}@s.whatsapp.net`;

    const result = await this.sock.sendMessage(jid, { text: message });
    return {
      success: true,
      messageId: result?.key?.id || null,
      to: cleanPhone,
    };
  }

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      // Ignore logout socket error if already disconnected
    }
    this.cleanAuthDir();
    this.status = 'disconnected';
    this.qrCode = null;
    this.userPhone = null;
    this.userName = null;
    this.sock = null;
    this.isInitializing = false;
    // Re-initialize to generate fresh QR
    await this.init();
    return { success: true };
  }

  async reconnect() {
    if (this.sock) {
      try {
        this.sock.end();
      } catch {
        // ignore
      }
    }
    this.sock = null;
    this.isInitializing = false;
    await this.init();
    return this.getStatus();
  }
}

export const whatsappService = new WhatsAppService();

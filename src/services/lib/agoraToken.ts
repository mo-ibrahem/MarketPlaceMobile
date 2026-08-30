// Agora RTC Token Generator for Mobile
// Generates official 006 HMAC-SHA256 signed tokens for Agora Mobile

function intToLittleEndianBytes(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

function packContent(items: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const item of items) total += 2 + item.length;
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const item of items) {
    buf[offset++] = item.length & 0xff;
    buf[offset++] = (item.length >> 8) & 0xff;
    buf.set(item, offset);
    offset += item.length;
  }
  return buf;
}

export async function generateClientAgoraToken(
  channelName: string,
  uid: number = 0,
  role: 'host' | 'audience' = 'host'
): Promise<string> {
  const appId = process.env.EXPO_PUBLIC_AGORA_APP_ID || 'f9fd0dadb9674b698d234f4551d6100b';
  const appCert = 'db1847c742744bdcbfc936d06357ef7e';

  if (!appId || !appCert) {
    return '';
  }

  const expireTs = Math.floor(Date.now() / 1000) + (role === 'host' ? 10800 : 7200);
  const agoraRole = role === 'host' ? 1 : 2;

  const encoder = new TextEncoder();
  const version = '006';
  const msgTs = Math.floor(Date.now() / 1000);
  const salt = Math.floor(Math.random() * 0xffffffff);

  // Privileges
  const privileges: Record<number, number> = {};
  if (agoraRole === 1) {
    privileges[1] = expireTs;
    privileges[2] = expireTs;
    privileges[3] = expireTs;
    privileges[5] = expireTs;
  } else {
    privileges[1] = expireTs;
    privileges[7] = expireTs;
    privileges[8] = expireTs;
  }

  const msgParts: Uint8Array[] = [
    intToLittleEndianBytes(salt),
    intToLittleEndianBytes(msgTs),
    intToLittleEndianBytes(expireTs),
  ];

  const privEntries = Object.entries(privileges);
  const privBuf = new Uint8Array(2 + privEntries.length * 6);
  let o = 0;
  privBuf[o++] = privEntries.length & 0xff;
  privBuf[o++] = (privEntries.length >> 8) & 0xff;
  for (const [k, v] of privEntries) {
    const key = parseInt(k);
    privBuf[o++] = key & 0xff;
    privBuf[o++] = (key >> 8) & 0xff;
    privBuf[o++] = v & 0xff;
    privBuf[o++] = (v >> 8) & 0xff;
    privBuf[o++] = (v >> 16) & 0xff;
    privBuf[o++] = (v >> 24) & 0xff;
  }
  msgParts.push(privBuf);

  const msgContent = packContent(msgParts);

  const uidStr = uid === 0 ? '' : String(uid);
  const sigStr = encoder.encode(appId + channelName + uidStr);
  const sigBuf = new Uint8Array([
    ...sigStr,
    ...intToLittleEndianBytes(msgTs),
    ...intToLittleEndianBytes(salt),
    ...msgContent,
  ]);

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appCert),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, sigBuf));

  const tokenParts = [
    encoder.encode(appId),
    encoder.encode(uidStr),
    encoder.encode(channelName),
    sigBytes,
    msgContent,
  ];
  const tokenContent = packContent(tokenParts);

  const base64 = btoa(String.fromCharCode(...tokenContent));
  return version + base64;
}

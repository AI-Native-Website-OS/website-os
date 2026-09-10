import { adminApi } from '@/lib/adminApi';

/** 后端对"已配置"敏感项的掩码占位（与后端 SensitiveKeys.MASK 一致）。 */
export const SECRET_MASK = '******';

/**
 * 获取 RSA 公钥并加密敏感值（OAEP-SHA256）。
 * 返回带 rsa:v1: 前缀的 Base64 密文，供后端私钥解密；明文不落请求体。
 */
export async function encryptSecret(plain: string): Promise<string> {
  const res: any = await adminApi.crypto.publicKey();
  const b64 = res?.data?.publicKey;
  if (!b64) {
    throw new Error('Failed to fetch public key');
  }
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'spki',
    der as BufferSource,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );
  const cipher = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(plain) as BufferSource,
  );
  const bytes = new Uint8Array(cipher);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'rsa:v1:' + btoa(binary);
}

/** 是否保留旧值（留空或掩码占位均表示不修改）。 */
export function isKeepExisting(value: string): boolean {
  return value.trim() === '' || value === SECRET_MASK;
}

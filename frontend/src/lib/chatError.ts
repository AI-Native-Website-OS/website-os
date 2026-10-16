import { t as translate } from '@/i18n/translate';

const ERROR_CODE_TO_KEY: Record<string, string> = {
  connection: 'publicComp.errorConnection',
  timeout: 'publicComp.errorTimeout',
  endpoint: 'publicComp.errorEndpoint',
  auth: 'publicComp.errorAuth',
  rate_limit: 'publicComp.errorRateLimit',
  config: 'publicComp.errorConfig',
  upstream: 'publicComp.errorUpstream',
  empty: 'publicComp.errorEmpty',
  unknown: 'publicComp.errorUnknown',
};

export const CHAT_ERROR_CODES = Object.keys(ERROR_CODE_TO_KEY);

export function friendlyChatError(code?: string | null): string {
  const key = ERROR_CODE_TO_KEY[code || ''] || ERROR_CODE_TO_KEY.unknown;
  return translate(key);
}


/**
 * @fileOverview 重要ファイルの定義と安全チェックロジック
 */

export const CRITICAL_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.ts',
  'next.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'apphosting.yaml',
  '.env',
  '.env.local',
  'src/app/layout.tsx',
  'src/firebase/config.ts'
];

/**
 * 重要なシステムファイルかどうかを判定
 */
export function isCriticalFile(path: string): boolean {
  const fileName = path.split('/').pop() || '';
  return CRITICAL_FILES.includes(fileName) || CRITICAL_FILES.includes(path);
}

/**
 * コード内に機密情報（APIキー等）が含まれているかスキャン
 */
export function detectSecrets(content: string): { found: boolean; types: string[] } {
  const findings: string[] = [];
  
  // Google API Key Pattern
  if (/AIza[0-9A-Za-z-_]{35}/.test(content)) {
    findings.push('Google API Key');
  }

  // Generic Secret Pattern (e.g., API_KEY="...")
  if (/(?:API_KEY|SECRET|PASSWORD|TOKEN)\s*[:=]\s*["'][0-9a-zA-Z-]{8,}["']/i.test(content)) {
    findings.push('Potential Hardcoded Secret');
  }

  return {
    found: findings.length > 0,
    types: findings
  };
}

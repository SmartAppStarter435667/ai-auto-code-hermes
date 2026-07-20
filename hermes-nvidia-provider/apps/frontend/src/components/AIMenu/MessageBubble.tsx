// apps/frontend/src/components/AIMenu/MessageBubble.tsx
import type { ChatEntry } from '../../lib/useHermesAgent';

function renderContent(text: string) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0].trim();
      const code = lines.slice(1).join('\n');
      return (
        <pre key={i} style={{
          background: '#050810', border: '1px solid #1a2535', borderRadius: 4,
          padding: '10px 14px', overflowX: 'auto', fontSize: 12, lineHeight: 1.7,
          margin: '8px 0', color: '#a8c4d8', position: 'relative',
        }}>
          {lang && <span style={{ position: 'absolute', top: 6, right: 10, fontSize: 10, color: '#2a4a5a', letterSpacing: 1 }}>{lang.toUpperCase()}</span>}
          <code>{code}</code>
        </pre>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ background: '#0d1520', border: '1px solid #1a2535', borderRadius: 3, padding: '1px 5px', color: '#7dd3fc', fontSize: 12 }}>{part.slice(1, -1)}</code>;
    }
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bp, j) => bp.startsWith('**') && bp.endsWith('**')
      ? <strong key={j} style={{ color: '#e2eaf4', fontWeight: 600 }}>{bp.slice(2, -2)}</strong>
      : <span key={j}>{bp}</span>);
  });
}

export function MessageBubble({ message, extraContent }: { message: ChatEntry; extraContent?: React.ReactNode }) {
  const isUser = message.role === 'user';

  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start', maxWidth: '100%' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: isUser ? '#0d1f2e' : '#0a1a10',
        border: `1px solid ${isUser ? '#1e3a5a' : '#1a4a28'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, flexShrink: 0, color: isUser ? '#4a8aaa' : '#4ade80',
      }}>
        {isUser ? 'U' : '⬡'}
      </div>

      <div style={{ flex: 1, maxWidth: 'calc(100% - 40px)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexDirection: isUser ? 'row-reverse' : 'row' }}>
          <span style={{ fontSize: 10, color: '#2a4a5a', letterSpacing: 1 }}>{isUser ? 'YOU' : 'HERMES'}</span>
          <span style={{ fontSize: 10, color: '#1a2a3a' }}>{new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>

        {extraContent}

        {message.content && (
          <div style={{
            background: isUser ? '#0d1a2a' : '#080e18',
            border: `1px solid ${isUser ? '#1a2f45' : '#131e2e'}`,
            borderRadius: 6, padding: '10px 14px', lineHeight: 1.75,
            color: '#bfcdd8', fontSize: 13, wordBreak: 'break-word', position: 'relative', overflow: 'hidden',
          }}>
            {message.isStreaming && (
              <span style={{ display: 'inline-block', width: 2, height: 14, background: '#00ffb4', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />
            )}
            <div style={{ lineHeight: 1.75 }}>{renderContent(message.content)}</div>
          </div>
        )}

        {message.toolCalls && message.toolCalls.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {message.toolCalls.map((tc, i) => (
              <span key={i} style={{ background: '#0a1510', border: '1px solid #1a3020', color: '#3a7a50', fontSize: 10, padding: '2px 8px', borderRadius: 3, letterSpacing: 0.5 }}>
                ⚡ {tc.tool.replace('_', '.')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

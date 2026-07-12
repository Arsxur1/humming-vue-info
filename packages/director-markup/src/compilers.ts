import type { MarkupDocument, MarkupNode } from './ast.js';

/**
 * Компилятор (а): AST → W3C SSML.
 *
 * Провайдеро-нейтральная стратегия: то, что выражается стандартным SSML
 * (break/emphasis/prosody/phoneme), компилируется напрямую; жесты, взгляд,
 * дыхание и эмоции — в <mark name="…"/>, которые TTS игнорирует, а пайплайн
 * использует для таймингов. Провайдерские диалекты (Azure mstts и т.п.) —
 * задача адаптеров Этапа 7 поверх этого же AST.
 */
export function compileToSSML(doc: MarkupDocument): string {
  return `<speak>${doc.children.map(nodeToSSML).join('')}</speak>`;
}

function nodeToSSML(node: MarkupNode): string {
  switch (node.type) {
    case 'text':
      return escapeXml(node.text);
    case 'pause':
      return `<break time="${formatSeconds(node.seconds)}"/>`;
    case 'breath':
      return `<mark name="breath"/>`;
    case 'gesture':
      return `<mark name="gesture:${node.gesture}"/>`;
    case 'look':
      return `<mark name="look:${node.target}"/>`;
    case 'emphasis':
      return `<emphasis level="strong">${node.children.map(nodeToSSML).join('')}</emphasis>`;
    case 'rate':
      return `<prosody rate="${Math.round(node.rate * 100)}%">${node.children
        .map(nodeToSSML)
        .join('')}</prosody>`;
    case 'pitch': {
      const sign = node.semitones >= 0 ? '+' : '';
      return `<prosody pitch="${sign}${node.semitones}st">${node.children
        .map(nodeToSSML)
        .join('')}</prosody>`;
    }
    case 'emotion':
      return `<mark name="emotion:${node.emotion}:start"/>${node.children
        .map(nodeToSSML)
        .join('')}<mark name="emotion:${node.emotion}:end"/>`;
    case 'phoneme':
      return `<phoneme alphabet="ipa" ph="${escapeXml(node.ipa)}">${escapeXml(node.text)}</phoneme>`;
  }
}

function formatSeconds(seconds: number): string {
  // < 1 c — в миллисекундах, целыми; иначе в секундах без хвостовых нулей
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  return `${Number(seconds.toFixed(3))}s`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Компилятор (б): AST → gesture_cues — сигналы для Avatar Driver.
 * `textOffset` — позиция в plain-тексте (выход компилятора (в)); alignment
 * из TTS превратит её во время.
 */
export interface GestureCue {
  kind: 'gesture' | 'look' | 'breath';
  /** Ключ жеста / направление взгляда / 'breath'. */
  key: string;
  /** Смещение в символах plain-текста, к которому привязан сигнал. */
  textOffset: number;
}

export function compileToGestureCues(doc: MarkupDocument): GestureCue[] {
  const cues: GestureCue[] = [];
  let offset = 0;

  const walk = (nodes: readonly MarkupNode[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          offset += node.text.length;
          break;
        case 'phoneme':
          offset += node.text.length;
          break;
        case 'gesture':
          cues.push({ kind: 'gesture', key: node.gesture, textOffset: offset });
          break;
        case 'look':
          cues.push({ kind: 'look', key: node.target, textOffset: offset });
          break;
        case 'breath':
          cues.push({ kind: 'breath', key: 'breath', textOffset: offset });
          break;
        case 'pause':
          break;
        default:
          walk(node.children);
      }
    }
  };

  walk(doc.children);
  return cues;
}

/** Компилятор (в): AST → чистый текст без разметки (для субтитров, hash сцены, модерации). */
export function compileToPlainText(doc: MarkupDocument): string {
  let out = '';
  const walk = (nodes: readonly MarkupNode[]): void => {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          out += node.text;
          break;
        case 'phoneme':
          out += node.text;
          break;
        case 'pause':
        case 'gesture':
        case 'look':
        case 'breath':
          break;
        default:
          walk(node.children);
      }
    }
  };
  walk(doc.children);
  return out;
}

/**
 * Токенизатор: текст → поток { text | open-tag | close-tag }.
 *
 * Тегом считается только конструкция вида [name], [name:value], [/name],
 * где name — латиница/цифры/дефис. Всё остальное в квадратных скобках
 * ([1], [источник], [see 4]) — обычный текст: скрипты часто содержат
 * скобки, не относящиеся к разметке.
 */

export interface TextToken {
  kind: 'text';
  text: string;
  start: number;
  end: number;
}

export interface TagToken {
  kind: 'tag';
  closing: boolean;
  name: string;
  value: string | null;
  start: number;
  end: number;
}

export type Token = TextToken | TagToken;

const TAG_AT = /^\[(\/?)([a-z][a-z0-9-]*)(?::([^\]\n]+))?\]/;

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let textStart = 0;
  let i = 0;

  const flushText = (end: number): void => {
    if (end > textStart) {
      tokens.push({ kind: 'text', text: source.slice(textStart, end), start: textStart, end });
    }
  };

  while (i < source.length) {
    if (source[i] !== '[') {
      i += 1;
      continue;
    }
    const match = TAG_AT.exec(source.slice(i));
    if (!match) {
      i += 1;
      continue;
    }
    flushText(i);
    const [raw, slash, name, value] = match;
    tokens.push({
      kind: 'tag',
      closing: slash === '/',
      name: name!,
      value: value ?? null,
      start: i,
      end: i + raw.length,
    });
    i += raw.length;
    textStart = i;
  }
  flushText(source.length);
  return tokens;
}

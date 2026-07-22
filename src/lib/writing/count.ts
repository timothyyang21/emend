export interface TextMetrics {
  words: number;
  chars: number;
  readingMinutes: number;
}

export function count(text: string): TextMetrics {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  return {
    words,
    chars: text.length,
    readingMinutes: words ? Math.ceil(words / 200) : 0,
  };
}

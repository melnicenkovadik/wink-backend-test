// letters, marks and digits of any script, so tags in Hindi or Thai work too
const HASHTAG_PATTERN = /^[\p{L}\p{M}\p{N}_]{1,50}$/u;

// NFC: "é" typed as one character or as "e" + accent must end up as the same tag
export const normalizeHashtag = (raw: string) =>
  raw.trim().replace(/^#+/, '').normalize('NFC').toLowerCase();

export const isValidHashtag = (tag: string) => HASHTAG_PATTERN.test(tag);

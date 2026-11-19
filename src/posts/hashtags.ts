const HASHTAG_PATTERN = /^[\p{L}\p{N}_]{1,50}$/u;

export const normalizeHashtag = (raw: string) => raw.trim().replace(/^#+/, '').toLowerCase();

export const isValidHashtag = (tag: string) => HASHTAG_PATTERN.test(tag);

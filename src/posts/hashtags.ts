const HASHTAG_PATTERN = /^[\p{L}\p{N}_]{1,50}$/u;

// "#NodeJS " and "nodejs" must end up as the same tag, both when saving and when filtering
export const normalizeHashtag = (raw: string) => raw.trim().replace(/^#+/, '').toLowerCase();

export const isValidHashtag = (tag: string) => HASHTAG_PATTERN.test(tag);

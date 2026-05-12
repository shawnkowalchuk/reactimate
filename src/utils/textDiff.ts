export interface TextEdit {
  /** Offset in the OLD text where the replaced range began. */
  editStart: number;
  /** Offset in the OLD text where the replaced range ended (exclusive). */
  editEnd: number;
  /** Length of the replacement string. */
  newLength: number;
}

/**
 * Find the minimal edit that turns `oldStr` into `newStr` as a single
 * range replacement. Returns `null` when the strings are identical.
 *
 * The algorithm: strip the longest common prefix and the longest
 * common suffix (without overlapping the prefix). The remaining slice
 * in `oldStr` is the replaced range; the remaining slice in `newStr`
 * is the replacement.
 *
 * Good enough for typed input (one cursor edit per keystroke).
 * The caller pipes this into `engine/ranges.adjustRanges` to keep
 * componentized index ranges consistent with the new text.
 */
export function diffStrings(oldStr: string, newStr: string): TextEdit | null {
  if (oldStr === newStr) return null;

  const oldLen = oldStr.length;
  const newLen = newStr.length;

  let cp = 0;
  const minLen = Math.min(oldLen, newLen);
  while (cp < minLen && oldStr.charCodeAt(cp) === newStr.charCodeAt(cp)) cp++;

  let cs = 0;
  const maxSuffix = minLen - cp;
  while (
    cs < maxSuffix &&
    oldStr.charCodeAt(oldLen - 1 - cs) === newStr.charCodeAt(newLen - 1 - cs)
  ) {
    cs++;
  }

  return {
    editStart: cp,
    editEnd: oldLen - cs,
    newLength: newLen - cp - cs,
  };
}

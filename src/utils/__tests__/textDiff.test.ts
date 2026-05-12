import { describe, it, expect } from "vitest";
import { diffStrings } from "../textDiff";

describe("diffStrings", () => {
  it("returns null when the strings are identical", () => {
    expect(diffStrings("hello", "hello")).toBeNull();
    expect(diffStrings("", "")).toBeNull();
  });

  it("detects a single-character insertion in the middle", () => {
    // "abc" → "abXc"
    expect(diffStrings("abc", "abXc")).toEqual({
      editStart: 2,
      editEnd: 2,
      newLength: 1,
    });
  });

  it("detects a deletion", () => {
    // "abcde" → "abde"  (deleted 'c' at index 2)
    expect(diffStrings("abcde", "abde")).toEqual({
      editStart: 2,
      editEnd: 3,
      newLength: 0,
    });
  });

  it("detects a replacement of a range with a longer string", () => {
    // "abcde" → "abXYZde"
    expect(diffStrings("abcde", "abXYZde")).toEqual({
      editStart: 2,
      editEnd: 3,
      newLength: 3,
    });
  });

  it("detects a paste at the start", () => {
    expect(diffStrings("world", "hello world")).toEqual({
      editStart: 0,
      editEnd: 0,
      newLength: 6,
    });
  });

  it("detects appended text", () => {
    expect(diffStrings("hello", "hello world")).toEqual({
      editStart: 5,
      editEnd: 5,
      newLength: 6,
    });
  });

  it("detects clearing all text", () => {
    expect(diffStrings("hello", "")).toEqual({
      editStart: 0,
      editEnd: 5,
      newLength: 0,
    });
  });

  it("does not let the common suffix overlap the common prefix", () => {
    // "aaa" → "aa". Naively, the suffix could double-count an 'a'.
    expect(diffStrings("aaa", "aa")).toEqual({
      editStart: 2,
      editEnd: 3,
      newLength: 0,
    });
  });

  it("handles a typing-at-the-end case (one char per keystroke)", () => {
    expect(diffStrings("hi", "hir")).toEqual({
      editStart: 2,
      editEnd: 2,
      newLength: 1,
    });
  });

  it("handles backspace at the start", () => {
    expect(diffStrings("abc", "bc")).toEqual({
      editStart: 0,
      editEnd: 1,
      newLength: 0,
    });
  });

  it("handles a select-all then replace (no shared chars)", () => {
    expect(diffStrings("abcd", "wxyz")).toEqual({
      editStart: 0,
      editEnd: 4,
      newLength: 4,
    });
  });

  it("trims off a shared trailing character even on a select-all-like replace", () => {
    // Both strings end in 't' → that's a 1-char common suffix.
    // Correct minimal edit: replace 0..7 with the first 14 chars of the new string.
    expect(diffStrings("old text", "new replacement")).toEqual({
      editStart: 0,
      editEnd: 7,
      newLength: 14,
    });
  });

  it("round-trips: applying the edit reconstructs newStr", () => {
    const cases: Array<[string, string]> = [
      ["hello", "hello world"],
      ["abc", "abXc"],
      ["abcde", "abde"],
      ["abcde", "abXYZde"],
      ["typing", "typi"],
      ["", "fresh"],
      ["fresh", ""],
    ];
    for (const [oldStr, newStr] of cases) {
      const edit = diffStrings(oldStr, newStr);
      if (!edit) continue;
      const replacement = newStr.slice(
        edit.editStart,
        edit.editStart + edit.newLength,
      );
      const reconstructed =
        oldStr.slice(0, edit.editStart) +
        replacement +
        oldStr.slice(edit.editEnd);
      expect(reconstructed).toBe(newStr);
    }
  });
});

// Module-level flag tracking whether the current editor project came from
// an example (or other override) and may still be hiding the user's actual
// cloud project. Extracted to its own module so saveToStorage can read it
// without creating a circular import with useCloudSync.
//
// Lifecycle:
//   1. User clicks "Open in Editor" on the homepage → markShadowProject()
//      sets the flag.
//   2. While the flag is true, the autosave pipeline still writes to
//      localStorage but SKIPS the Firestore save (so the user's cloud
//      project isn't silently clobbered by the example).
//   3. First time the user clicks Save in the toolbar and confirms the
//      cloud-overwrite prompt → clearShadowFlag() flips it off and
//      subsequent autosaves push to the DB normally.

let _isShadow = false;

export function markShadowProject(): void {
  _isShadow = true;
}

export function isShadowProject(): boolean {
  return _isShadow;
}

export function clearShadowFlag(): void {
  _isShadow = false;
}

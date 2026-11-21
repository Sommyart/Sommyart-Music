/**
 * Whether to show the "install the app" banner. Only on the website, and not on iPhone or iPad,
 * where the Android app cannot be installed.
 */
export function shouldOfferApp(isNativeApp: boolean, userAgent: string): boolean {
  if (isNativeApp) return false;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return false;
  return true;
}

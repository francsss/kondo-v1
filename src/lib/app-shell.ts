/**
 * Routes that take over the screen and drop the app chrome.
 *
 * A conversation is the clearest case: the composer sits at the bottom of the
 * viewport, which is exactly where the mobile quick-nav floats, so leaving the
 * nav in place puts a navigation bar on top of the send button.
 */
export function usesImmersiveAppShell(pathname: string) {
  return (
    /^\/messages\/[^/]+$/.test(pathname) ||
    // The Marketplace thread is the same conversation shell, so it needs the
    // same treatment. The inbox above it is an ordinary page and is not
    // matched: this only covers a thread's own route.
    /^\/marketplace\/messages\/[^/]+$/.test(pathname) ||
    /^\/communities\/[^/]+$/.test(pathname) ||
    pathname === "/stories"
  );
}

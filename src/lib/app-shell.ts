export function usesImmersiveAppShell(pathname: string) {
  return (
    /^\/messages\/[^/]+$/.test(pathname) ||
    /^\/communities\/[^/]+$/.test(pathname)
  );
}

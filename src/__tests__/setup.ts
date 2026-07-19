// jsdom implements neither ResizeObserver nor matchMedia, both of which
// Vuetify's layout components and the app store rely on. Provide minimal
// stubs so components can mount under the test environment.

globalThis.ResizeObserver ??= class {
  observe () {}
  unobserve () {}
  disconnect () {}
}

// The router's scrollBehavior calls window.scrollTo, which jsdom defines only
// as a throwing "not implemented" stub; replace it so navigation is quiet.
window.scrollTo = (() => {}) as typeof window.scrollTo

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList
}

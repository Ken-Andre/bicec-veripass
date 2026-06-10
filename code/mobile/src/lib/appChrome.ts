export function setViewportChromeColor(color: string) {
  document.documentElement.style.setProperty('--app-viewport-bg', color);
  document.body.style.setProperty('background-color', color);
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', color);
}

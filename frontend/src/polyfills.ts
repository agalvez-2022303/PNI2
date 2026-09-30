/**
 * Sanea el locale por defecto. Algunos entornos headless reportan
 * navigator.language = 'en-US@posix', una etiqueta BCP-47 inválida que hace
 * fallar a Intl.NumberFormat (usado por uPlot al importarse). Debe ejecutarse
 * ANTES de cargar cualquier librería que use Intl.
 */
try {
  const lang = typeof navigator !== 'undefined' ? navigator.language : '';
  if (!lang || /@|posix/i.test(lang)) {
    Object.defineProperty(navigator, 'language', { value: 'en-US', configurable: true });
    Object.defineProperty(navigator, 'languages', { value: ['en-US'], configurable: true });
  }
} catch {
  /* noop */
}

export {};

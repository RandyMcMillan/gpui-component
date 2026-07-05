// Suppress noisy wasm/Safari console errors while preserving real errors
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
let _origConsoleError = null;
if (isSafari) {
  _origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && (msg.includes('wasm-function') || msg.includes('wasm_bindgen') || msg.includes('getStringFromWasm0') || msg.includes('wasm')) ) {
      return; // swallow wasm/Safari noise
    }
    _origConsoleError(...args);
  };
}

// Global runtime error handlers to catch wasm exceptions (e.g., from wasm-bindgen closures)
window.addEventListener('error', (ev) => {
  // ev.message or ev.error may contain wasm traces — filter for Safari/noise
  const msg = ev.message || (ev.error && ev.error.message) || '';
  if (isSafari && /wasm|wasm-function|wasm_bindgen|getStringFromWasm0/.test(msg)) {
    ev.preventDefault(); // suppress default logging in some browsers
    return;
  }
  if (_origConsoleError) _origConsoleError('Unhandled error:', ev.error || msg, ev);
});

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason || '';
  if (isSafari && /wasm|wasm-function|wasm_bindgen|getStringFromWasm0/.test(String(reason))) {
    ev.preventDefault();
    return;
  }
  if (_origConsoleError) _origConsoleError('Unhandled rejection:', reason);
});

async function init() {
  const loadingEl = document.getElementById('loading');
  const appEl = document.getElementById('app');

  try {
    // Check WebGPU availability and show a user-friendly message if unavailable
    if (!('gpu' in navigator)) {
      if (loadingEl) {
        loadingEl.innerHTML = `<div class="error"><h2>WebGPU not available</h2><p>Please use Chrome/Edge Canary with --enable-unsafe-webgpu or enable WebGPU in Safari Technology Preview.</p></div>`;
      }
      console.warn('WebGPU unavailable — skipping initialization');
      return;
    }

    // Import the WASM module
    const wasm = await import('./wasm/gpui_component_story_web.js');
    await wasm.default();

    // Initialize the story gallery
    await wasm.run();

    // Hide loading indicator
    if (appEl) {
      appEl.remove();
    }
  } catch (error) {
    console.error('Failed to initialize:', error);

    // Show error message
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="error">
          <h2>Failed to load the application</h2>
          <p>${error.message || error}</p>
          <p style="margin-top: 10px; font-size: 14px;">
            Please check the console for more details.
          </p>
        </div>
      `;
    }
  }
}

init();

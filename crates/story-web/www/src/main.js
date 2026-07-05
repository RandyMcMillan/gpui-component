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
        loadingEl.innerHTML = `
          <div class="error">
            <h2>WebGPU not available</h2>
            <p>Your browser does not expose WebGPU. To run the gallery you need a browser with WebGPU support (Chrome/Edge Canary or Safari Technology Preview with WebGPU enabled).</p>
            <div style="margin-top:12px;">
              <button id="try-anyway" style="margin-right:8px;padding:8px 12px;">Try anyway</button>
              <button id="minimal-ui" style="padding:8px 12px;">Show minimal gallery</button>
            </div>
          </div>`;
      }
      console.warn('WebGPU unavailable — offering fallback UI');

      // Wire up buttons: Try anyway will attempt full init; minimal UI shows a static placeholder
      setTimeout(() => {
        const tryBtn = document.getElementById('try-anyway');
        const minimalBtn = document.getElementById('minimal-ui');
        if (tryBtn) {
          tryBtn.addEventListener('click', async () => {
            // remove loading message and proceed with normal init
            if (loadingEl) loadingEl.remove();
            await loadWasmAndRun();
          });
        }
        if (minimalBtn) {
          minimalBtn.addEventListener('click', () => {
            if (loadingEl) {
              loadingEl.innerHTML = `<div class="info"><h3>Minimal gallery</h3><p>The full GPU-accelerated gallery is unavailable. Showing a simplified read-only list of components for exploration.</p></div>`;
            }
            // Optionally populate a simple list of components (keeps dev flow going)
            showMinimalGallery();
          });
        }
      }, 0);

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

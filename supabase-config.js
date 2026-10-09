/**
 * Supabase Backend Configuration & Client Initializer
 * Envision IIM Bodh Gaya
 */
window.ENVISION_SUPABASE_CONFIG = {
  url: 'https://jloywbovucitjxihdibb.supabase.co',
  publishableKey: 'sb_publishable_QwAnt4XEwFco_YEoWIy-pQ_ZIs4zdYl'
};

(function () {
  'use strict';
  const config = window.ENVISION_SUPABASE_CONFIG;
  if (!config || !config.url || !config.publishableKey) return;

  function initClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        window.supabaseClient = window.supabase.createClient(config.url, config.publishableKey);
        window.dispatchEvent(new CustomEvent('supabaseReady', { detail: window.supabaseClient }));
      } catch (err) {
        console.warn('[Supabase] Initialization failed:', err);
      }
    }
  }

  if (window.supabase) {
    initClient();
  } else {
    const script = document.createElement('script');
    script.src = 'supabase-js.js';
    script.async = true;
    script.onload = initClient;
    script.onerror = () => {
      console.error('[Supabase] Failed to load the local client library.');
    };
    document.head.appendChild(script);
  }
})();
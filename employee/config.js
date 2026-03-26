window.APP_CONFIG = {
  // Web: auto-use current host (works when served from Hostinger domain).
  apiBase:
    typeof window !== 'undefined' && /^https?:/i.test(String(window.location.origin || ''))
      ? String(window.location.origin).replace(/\/+$/, '')
      : '',
  // Mobile (Capacitor): set your Hostinger HTTPS domain if you want default app API.
  hostingerApiBase: '',
  googleMapsKey: ''
};

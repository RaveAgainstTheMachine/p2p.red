let messages = [];
let sw = null;
let scope = '';
let keepAliveInterval = null;

const KEEP_ALIVE_MS = 1500;

const postToParent = (payload) => {
  const target = window.parent || window.opener;
  if (!target) return;
  try {
    target.postMessage(payload, location.origin);
  } catch (error) {
    console.warn('[download-bridge] Unable to notify parent', error);
  }
};

const startKeepAlive = () => {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    if (sw) {
      sw.postMessage({ type: 'ping' });
    } else {
      fetch(`${scope || location.origin}/download-bridge/ping`).catch(() => {});
    }
  }, KEEP_ALIVE_MS);
};

const registerWorker = () =>
  navigator.serviceWorker
    .getRegistration('./')
    .then((swReg) => swReg || navigator.serviceWorker.register('sw.js', { scope: './' }))
    .then((swReg) => {
      const swRegTmp = swReg.installing || swReg.waiting;
      scope = swReg.scope;
      return swReg.active ||
        new Promise((resolve) => {
          swRegTmp.addEventListener('statechange', function fn() {
            if (swRegTmp.state === 'activated') {
              swRegTmp.removeEventListener('statechange', fn);
              sw = swReg.active;
              resolve();
            }
          });
        });
    })
    .then(() => {
      sw = sw || navigator.serviceWorker.controller || sw;
    });

const onMessage = (event) => {
  const { data, ports, origin } = event;
  if (!ports || !ports.length) {
    throw new TypeError('[download-bridge] Missing messageChannel');
  }
  if (typeof data !== 'object') {
    throw new TypeError('[download-bridge] Missing payload');
  }

  data.origin = origin;
  data.referrer = data.referrer || document.referrer || origin;
  if (!data.transferId) {
    throw new TypeError('[download-bridge] Missing transferId');
  }
  if (!data.pathname) {
    data.pathname = `download/${data.transferId}`;
  }

  data.pathname = data.pathname.replace(/^\/+/, '');
  const baseUrl = scope || `${origin}/`;
  data.url = new URL(data.pathname, baseUrl).toString();

  const port = ports[0];
  port.onmessage = (evt) => {
    if (evt.data?.debug) {
      postToParent({ type: 'download_bridge_debug', detail: evt.data.debug });
    }
    if (evt.data?.download) {
      postToParent({ type: 'download_bridge_download', url: evt.data.download });
    }
  };

  if (!sw) {
    postToParent({ type: 'download_bridge_error', detail: 'worker_missing' });
    return;
  }

  sw.postMessage(data, [port]);
  startKeepAlive();
};

registerWorker().then(() => {
  postToParent({ type: 'download_bridge_debug', detail: 'worker_ready' });
  window.onmessage = onMessage;
  messages.forEach(onMessage);
  messages = [];
});

window.onmessage = (evt) => messages.push(evt);

/* Run this whole expression in the target page's JavaScript context. */
(() => {
  'use strict';
  const key = '__examBrowserQA';
  if (window[key]) {
    if (window[key].version !== 2) throw new Error('QA helper name collision');
    return window[key].status();
  }
  const proto = XMLHttpRequest.prototype;
  const original = { fetch: window.fetch, open: proto.open, send: proto.send, abort: proto.abort };
  const metadata = new WeakMap();
  const pending = new Map();
  let rule = null;
  let hits = 0;
  let enabled = true;
  const body = '{"message":"Simulated unauthorized response","qaMock":true}';

  function matches(url, method) {
    if (!enabled || !rule) return false;
    const parsed = new URL(url, document.baseURI);
    return parsed.origin === rule.origin && parsed.pathname === rule.pathname && method === rule.method;
  }

  function fetchWrapper(input, init) {
    const isRequest = input instanceof Request;
    const url = isRequest ? input.url : String(input);
    const method = String(init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
    if (!matches(url, method)) return original.fetch.apply(this, arguments);
    const signal = init?.signal ?? (isRequest ? input.signal : null);
    if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    hits += 1;
    if (rule.mode === 'network-error') return Promise.reject(new TypeError('Failed to fetch (QA mock)'));
    return Promise.resolve(new Response(body, {
      status: 401, statusText: 'Unauthorized', headers: { 'Content-Type': 'application/json' },
    }));
  }

  function clearShadows(xhr, meta) {
    if (!meta?.shadows) return;
    for (const [name, descriptor] of meta.shadows) {
      if (descriptor) Object.defineProperty(xhr, name, descriptor);
      else delete xhr[name];
    }
    meta.shadows = null;
  }

  function openWrapper(method, url) {
    const task = pending.get(this);
    if (task) { clearTimeout(task.timer); pending.delete(this); }
    clearShadows(this, metadata.get(this));
    const result = original.open.apply(this, arguments);
    metadata.set(this, { method: String(method).toUpperCase(), url: new URL(url, document.baseURI).href, async: arguments[2] !== false });
    return result;
  }

  function shadow(xhr, meta, values) {
    meta.shadows = Object.keys(values).map(name => [name, Object.getOwnPropertyDescriptor(xhr, name)]);
    for (const [name, value] of Object.entries(values)) {
      Object.defineProperty(xhr, name, { configurable: true, writable: true, value });
    }
  }

  function finish(xhr, eventName) {
    const task = pending.get(xhr);
    if (!task) return;
    clearTimeout(task.timer);
    pending.delete(xhr);
    const meta = metadata.get(xhr);
    const unauthorized = task.mode === 'http-401' && eventName === 'load';
    let response = '';
    if (unauthorized) {
      if (xhr.responseType === 'json') response = JSON.parse(body);
      else if (xhr.responseType === 'blob') response = new Blob([body], { type: 'application/json' });
      else if (xhr.responseType === 'arraybuffer') response = new TextEncoder().encode(body).buffer;
      else response = body;
    } else if (xhr.responseType && xhr.responseType !== 'text') response = null;
    shadow(xhr, meta, {
      readyState: 4, status: unauthorized ? 401 : 0,
      statusText: unauthorized ? 'Unauthorized' : '',
      responseURL: unauthorized ? meta.url : '', response,
      responseText: unauthorized ? body : '', responseXML: null,
      getAllResponseHeaders: () => unauthorized ? 'content-type: application/json\r\n' : '',
      getResponseHeader: name => unauthorized && String(name).toLowerCase() === 'content-type' ? 'application/json' : null,
    });
    xhr.dispatchEvent(new Event('readystatechange'));
    xhr.dispatchEvent(new ProgressEvent(eventName));
    xhr.dispatchEvent(new ProgressEvent('loadend'));
    if (eventName === 'abort') xhr.readyState = 0;
  }

  function sendWrapper() {
    const meta = metadata.get(this);
    if (!meta || !matches(meta.url, meta.method)) return original.send.apply(this, arguments);
    if (!meta.async) throw new DOMException('QA mock only supports asynchronous XHR', 'NotSupportedError');
    if (this.readyState !== 1 || pending.has(this)) throw new DOMException('Invalid XHR state', 'InvalidStateError');
    // No native send: even mutation request bodies never leave this page.
    hits += 1;
    const mode = rule.mode;
    const task = { mode, timer: setTimeout(() => finish(this, mode === 'http-401' ? 'load' : 'error'), 0) };
    pending.set(this, task);
    this.dispatchEvent(new ProgressEvent('loadstart'));
  }

  function abortWrapper() {
    if (pending.has(this)) { finish(this, 'abort'); return; }
    return original.abort.apply(this, arguments);
  }

  function status() {
    return { version: 2, enabled, rule: rule ? { ...rule } : null, hits,
      installed: window.fetch === fetchWrapper && proto.open === openWrapper && proto.send === sendWrapper && proto.abort === abortWrapper };
  }

  const api = {
    version: 2,
    status,
    configure(config) {
      if (!status().installed) throw new Error('Interception changed; restore before continuing');
      const url = new URL(config.url, document.baseURI);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Invalid target URL');
      if (!['network-error', 'http-401'].includes(config.mode)) throw new Error('Unsupported mock mode');
      if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(config.method)) throw new Error('Explicit uppercase HTTP method required');
      if (pending.size) throw new Error('Mock request pending; wait before changing cases');
      rule = { origin: url.origin, pathname: url.pathname, method: config.method, mode: config.mode };
      hits = 0;
      return status();
    },
    restore() {
      enabled = false;
      rule = null;
      for (const xhr of [...pending.keys()]) finish(xhr, 'abort');
      // Do not overwrite another tool's more recent wrappers.
      const conflicts = [];
      for (const [target, name, wrapper] of [[window, 'fetch', fetchWrapper], [proto, 'open', openWrapper], [proto, 'send', sendWrapper], [proto, 'abort', abortWrapper]]) {
        if (target[name] === wrapper) target[name] = original[name];
        else conflicts.push(name);
      }
      if (!conflicts.length) delete window[key];
      return { restored: !conflicts.length, conflicts, mockDisabled: true };
    },
  };
  window.fetch = fetchWrapper;
  proto.open = openWrapper;
  proto.send = sendWrapper;
  proto.abort = abortWrapper;
  window[key] = api;
  return status();
})();

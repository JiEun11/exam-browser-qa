const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const { JSDOM } = createRequire(require.resolve('jest-environment-jsdom'))('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../scripts/install.js'), 'utf8');
const axiosSource = fs.readFileSync(path.join(path.dirname(require.resolve('axios/package.json')), 'dist/axios.js'), 'utf8');

async function fixture(t) {
  const received = [];
  const server = http.createServer((req, res) => {
    received.push({ method: req.method, path: req.url });
    res.setHeader('Content-Type', 'application/json');
    res.end('{"ok":true}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const dom = new JSDOM('', { url: origin, runScripts: 'outside-only' });
  const w = dom.window;
  w.Request = Request; w.Response = Response; w.TextEncoder = TextEncoder;
  w.fetch = (input, init) => fetch(input instanceof Request ? input : new URL(input, origin), init);
  w.eval(axiosSource); // axios exists before injection, as on the exam page.
  const original = { fetch: w.fetch, open: w.XMLHttpRequest.prototype.open, send: w.XMLHttpRequest.prototype.send };
  w.eval(source);
  t.after(() => { w.__examBrowserQA?.restore(); w.close(); });
  return { w, received, origin, original };
}

test('fetch blocks selected method/path before server, passes other paths and methods', async t => {
  const { w, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: '/api/submit', method: 'POST', mode: 'network-error' });
  await assert.rejects(w.fetch('/api/submit?attempt=2', { method: 'POST', body: 'private' }), /Failed to fetch/);
  assert.equal(received.length, 0);
  await w.fetch('/api/submit');
  await w.fetch('/api/autosave', { method: 'POST' });
  assert.equal(received.length, 2);
  assert.equal(w.__examBrowserQA.status().hits, 1);
});

test('axios XHR network failure does not send mutation, autosave still works', async t => {
  const { w, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: '/api/reset', method: 'POST', mode: 'network-error' });
  await assert.rejects(w.axios.post('/api/reset', { sensitive: 'not sent' }), e => e.code === 'ERR_NETWORK');
  assert.equal(received.length, 0);
  const response = await w.axios.post('/api/autosave', {});
  assert.equal(response.data.ok, true);
  assert.equal(received.length, 1);
});

test('401 reaches axios response interceptor and fetch Request without server traffic', async t => {
  const { w, origin, received } = await fixture(t);
  let interceptedStatus;
  w.axios.interceptors.response.use(undefined, error => { interceptedStatus = error.response?.status; return Promise.reject(error); });
  w.__examBrowserQA.configure({ url: '/api/info', method: 'GET', mode: 'http-401' });
  await assert.rejects(w.axios.get('/api/info'), e => e.response.status === 401 && e.response.data.qaMock === true);
  assert.equal(interceptedStatus, 401);
  const response = await w.fetch(new Request(`${origin}/api/info?secret=hidden`));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).qaMock, true);
  assert.equal(received.length, 0);
  assert.equal(JSON.stringify(w.__examBrowserQA.status()).includes('secret'), false);
});

test('401 also reaches fulfilled axios interceptors when validateStatus accepts errors', async t => {
  const { w, received } = await fixture(t);
  let expired = false;
  w.axios.interceptors.response.use(response => {
    if (response.status === 401) expired = true;
    return response;
  });
  w.__examBrowserQA.configure({ url: '/api/info', method: 'GET', mode: 'http-401' });
  const response = await w.axios.get('/api/info', { validateStatus: () => true });
  assert.equal(response.status, 401);
  assert.equal(expired, true);
  assert.equal(received.length, 0);
});

test('XHR error event order, reuse after mock and explicit abort', async t => {
  const { w, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: '/api/info', method: 'GET', mode: 'network-error' });
  const xhr = new w.XMLHttpRequest();
  xhr.open('GET', '/api/info');
  const events = [];
  for (const name of ['readystatechange', 'error', 'loadend']) xhr.addEventListener(name, () => events.push(name));
  await new Promise(resolve => { xhr.onloadend = resolve; xhr.send(); });
  assert.deepEqual(events, ['readystatechange', 'error', 'loadend']);
  assert.equal(xhr.status, 0);
  assert.equal(xhr.readyState, 4);
  xhr.open('GET', '/api/other');
  await new Promise(resolve => { xhr.onloadend = resolve; xhr.send(); });
  assert.equal(xhr.status, 200);
  assert.equal(received.length, 1);
  xhr.open('GET', '/api/info');
  let aborted = false;
  xhr.onabort = () => { aborted = true; };
  xhr.send(); xhr.abort();
  assert.equal(aborted, true);
  assert.equal(xhr.readyState, 0);
});

test('rule replacement, repeat injection, restore original functions and normal requests', async t => {
  const { w, original, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: '/api/a', method: 'GET', mode: 'network-error' });
  const wrapped = w.fetch;
  w.eval(source);
  assert.equal(w.fetch, wrapped);
  w.__examBrowserQA.configure({ url: '/api/b', method: 'GET', mode: 'network-error' });
  await w.fetch('/api/a');
  assert.equal(w.__examBrowserQA.restore().restored, true);
  assert.equal(w.fetch, original.fetch);
  assert.equal(w.XMLHttpRequest.prototype.open, original.open);
  assert.equal(w.XMLHttpRequest.prototype.send, original.send);
  await w.axios.get('/api/b');
  assert.equal(received.length, 2);
  assert.equal(w.__examBrowserQA, undefined);
});

test('preserves later third-party wrappers and disables own matching', async t => {
  const { w, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: '/api/info', method: 'GET', mode: 'network-error' });
  const ownFetch = w.fetch;
  const thirdParty = (...args) => ownFetch(...args);
  w.fetch = thirdParty;
  const result = w.__examBrowserQA.restore();
  assert.equal(result.mockDisabled, true);
  assert.equal(result.restored, false);
  assert.equal(w.fetch, thirdParty);
  await w.fetch('/api/info');
  assert.equal(received.length, 1);
});

test('aborted fetch and restore during pending XHR never send matched request', async t => {
  const { w, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: '/api/info', method: 'GET', mode: 'network-error' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(w.fetch('/api/info', { signal: controller.signal }), e => e.name === 'AbortError');
  const xhr = new w.XMLHttpRequest(); xhr.open('GET', '/api/info');
  let aborted = false; xhr.onabort = () => { aborted = true; };
  xhr.send(); w.__examBrowserQA.restore();
  assert.equal(aborted, true);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(received.length, 0);
});

test('origin isolation and unsupported synchronous XHR fail safely', async t => {
  const { w, received } = await fixture(t);
  w.__examBrowserQA.configure({ url: 'https://other.invalid/api/info', method: 'GET', mode: 'network-error' });
  await w.fetch('/api/info');
  assert.equal(received.length, 1);
  w.__examBrowserQA.configure({ url: '/api/info', method: 'GET', mode: 'network-error' });
  const xhr = new w.XMLHttpRequest();
  xhr.open('GET', '/api/info', false);
  assert.throws(() => xhr.send(), e => e.name === 'NotSupportedError');
  assert.equal(received.length, 1);
});

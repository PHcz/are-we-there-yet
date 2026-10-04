async function check(res, name) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${name}: HTTP ${res.status} ${text.slice(0, 200)}`.trim());
  }
}

export async function postJson(url, body, { headers = {}, signal, name }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  await check(res, name);
}

export async function postForm(url, fields, { signal, name }) {
  const res = await fetch(url, { method: 'POST', body: new URLSearchParams(fields), signal });
  await check(res, name);
}

export function requireKeys(cfg, keys, name) {
  for (const k of keys) if (!cfg?.[k]) throw new Error(`${name}: missing ${k}`);
}

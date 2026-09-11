/**
 * Provider-format transport helpers and strict metadata validation.
 *
 * These functions deliberately know nothing about individual providers. The
 * caller supplies the transport settings from provider-registry.js, so every
 * provider sharing a wire format uses exactly the same request/response path.
 */

export function cleanBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function authHeaders(auth, apiKey) {
  if (auth?.type === 'bearer') return { [auth.header || 'Authorization']: `Bearer ${apiKey}` };
  if (auth?.type === 'headers') {
    return Object.fromEntries(Object.entries(auth.headers || {}).map(([name, value]) => [
      name,
      String(value).replace('API_KEY', () => apiKey)
    ]));
  }
  return {};
}

/** Gemini native REST request. API key authentication is a query parameter. */
export function buildGeminiRequest(baseUrl, apiKey, model, systemPrompt, userText, imageBase64, mimeType, auth = { type: 'query', parameter: 'key' }) {
  const keyParameter = auth.parameter || 'key';
  const url = `${cleanBaseUrl(baseUrl)}/models/${encodeURIComponent(model)}:generateContent?${encodeURIComponent(keyParameter)}=${encodeURIComponent(apiKey)}`;
  return {
    url,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userText }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        generationConfig: { temperature: 0.4 }
      })
    }
  };
}

/** OpenAI Chat Completions-compatible request. */
export function buildOpenAIRequest(baseUrl, apiKey, model, systemPrompt, userText, imageBase64, mimeType, auth = { type: 'bearer', header: 'Authorization' }) {
  return {
    url: `${cleanBaseUrl(baseUrl)}/chat/completions`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(auth, apiKey) },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }] }
        ],
        temperature: 0.4
      })
    }
  };
}

/** Anthropic Messages-compatible request. */
export function buildAnthropicRequest(baseUrl, apiKey, model, systemPrompt, userText, imageBase64, mimeType, auth = { type: 'headers', headers: { 'x-api-key': 'API_KEY', 'anthropic-version': '2023-06-01' } }) {
  return {
    url: `${cleanBaseUrl(baseUrl)}/messages`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(auth, apiKey) },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: [{ type: 'text', text: userText }, { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } }] }]
      })
    }
  };
}

export const REQUEST_BUILDERS = Object.freeze({
  'gemini-native': buildGeminiRequest,
  'openai-chat-completions': buildOpenAIRequest,
  'anthropic-messages': buildAnthropicRequest
});

export function parseGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map(part => typeof part?.text === 'string' ? part.text : '').join('\n').trim();
}

export function parseOpenAIResponse(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => typeof part?.text === 'string' ? part.text : (typeof part?.content === 'string' ? part.content : '')).join('\n').trim();
  }
  return '';
}

export function parseAnthropicResponse(data) {
  const content = data?.content;
  if (!Array.isArray(content)) return '';
  return content.map(part => part?.type === 'text' && typeof part.text === 'string' ? part.text : '').join('\n').trim();
}

export const RESPONSE_PARSERS = Object.freeze({
  'gemini-native': parseGeminiResponse,
  'openai-chat-completions': parseOpenAIResponse,
  'anthropic-messages': parseAnthropicResponse
});

export function parseModelJson(rawText) {
  const trimmed = String(rawText || '').trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(withoutFence); }
  catch (_) {
    const first = withoutFence.indexOf('{');
    const last = withoutFence.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(withoutFence.slice(first, last + 1)); } catch (_) { /* clear error below */ }
    }
    throw new Error('The provider response was not valid JSON. Please regenerate.');
  }
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Strict and provider-neutral: this is the only gate before metadata may be
 * put on a card or in an export. It does not coerce or silently fill fields.
 */
export function validateMetadataOutput(obj) {
  const issues = [];
  if (!isPlainObject(obj)) return { valid: false, issues: ['response must be a JSON object'] };
  if (typeof obj.description !== 'string' || !obj.description.trim()) issues.push('description must be a non-empty string');
  if (!isPlainObject(obj.platforms)) issues.push('platforms must be an object');
  else {
    const requiredPlatforms = { adobe_stock: 5, shutterstock: 7, istock_getty: 5, freepik_vecteezy: 5 };
    Object.entries(requiredPlatforms).forEach(([platformId, minimumKeywords]) => {
      const platform = obj.platforms[platformId];
      if (!isPlainObject(platform)) { issues.push(`platforms.${platformId} is missing`); return; }
      if (typeof platform.title !== 'string' || !platform.title.trim()) issues.push(`platforms.${platformId}.title must be a non-empty string`);
      if (!Array.isArray(platform.keywords) || platform.keywords.length < minimumKeywords) issues.push(`platforms.${platformId}.keywords needs at least ${minimumKeywords} strings`);
      else if (platform.keywords.some(keyword => typeof keyword !== 'string' || !keyword.trim())) issues.push(`platforms.${platformId}.keywords must contain only non-empty strings`);
    });
  }
  if (typeof obj.category_suggestion !== 'string') issues.push('category_suggestion must be a string');
  if (!Array.isArray(obj.flags)) issues.push('flags must be an array');
  else if (obj.flags.some(flag => typeof flag !== 'string')) issues.push('flags must contain only strings');
  return issues.length ? { valid: false, issues } : { valid: true, value: obj };
}

export function validatedMetadataFromText(rawText) {
  const candidate = parseModelJson(rawText);
  const result = validateMetadataOutput(candidate);
  if (!result.valid) throw new Error(`Incomplete response, please regenerate. ${result.issues.join('; ')}.`);
  return result.value;
}

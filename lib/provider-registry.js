/**
 * Tagbench provider registry
 *
 * This is intentionally the single source of truth for provider identity,
 * transport, authentication, defaults, and endpoint cautions. The UI and the
 * request layer both import it; do not copy endpoint or auth values elsewhere.
 */

export const PROVIDER_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'gemini',
    label: 'Google Gemini',
    wireFormat: 'gemini-native',
    supportedWireFormats: Object.freeze(['gemini-native']),
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: Object.freeze({ type: 'query', parameter: 'key' }),
    models: Object.freeze(['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite']),
    notes: 'Google can deprecate model IDs without notice. A 404 that names a replacement is logged for review; this app never adopts it automatically.'
  }),
  Object.freeze({
    id: 'anthropic',
    label: 'Anthropic Claude (official)',
    wireFormat: 'anthropic-messages',
    supportedWireFormats: Object.freeze(['anthropic-messages']),
    baseUrl: 'https://api.anthropic.com/v1',
    auth: Object.freeze({ type: 'headers', headers: Object.freeze({ 'x-api-key': 'API_KEY', 'anthropic-version': '2023-06-01' }) }),
    models: Object.freeze(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'])
  }),
  Object.freeze({
    id: 'openai',
    label: 'OpenAI (official)',
    wireFormat: 'openai-chat-completions',
    supportedWireFormats: Object.freeze(['openai-chat-completions']),
    baseUrl: 'https://api.openai.com/v1',
    auth: Object.freeze({ type: 'bearer', header: 'Authorization' }),
    models: Object.freeze(['gpt-4o', 'gpt-4o-mini']),
    notes: 'You may type a custom model ID; OpenAI model lists change quickly.'
  }),
  Object.freeze({
    id: 'helyx',
    label: 'Helyx AI',
    wireFormat: 'openai-chat-completions',
    supportedWireFormats: Object.freeze(['openai-chat-completions']),
    baseUrl: 'https://helyxai.space/v1',
    auth: Object.freeze({ type: 'bearer', header: 'Authorization' }),
    models: Object.freeze([]),
    notes: 'OpenAI-compatible only; it does not provide an Anthropic-format route.'
  }),
  Object.freeze({
    id: 'vyce',
    label: 'Vyce AI',
    wireFormat: 'openai-chat-completions',
    supportedWireFormats: Object.freeze(['openai-chat-completions', 'anthropic-messages']),
    baseUrl: 'https://vyceai.com/v1',
    auth: Object.freeze({ type: 'bearer', header: 'Authorization' }),
    models: Object.freeze([]),
    notes: 'Defaults to OpenAI-compatible requests. If a request fails, verify the configured base URL in Vyce’s own documentation; do not assume a replacement path.',
    vyceEndpointWarning: true
  }),
  Object.freeze({
    id: 'xkiro',
    label: 'xKiro',
    wireFormat: 'openai-chat-completions',
    supportedWireFormats: Object.freeze(['openai-chat-completions', 'anthropic-messages']),
    baseUrl_openai: 'https://api.xkiro.com/v1',
    baseUrl_anthropic: 'https://api.xkiro.com',
    auth: Object.freeze({ type: 'bearer', header: 'Authorization' }),
    models: Object.freeze([]),
    requiresVendorModelPrefix: true,
    notes: 'Use a vendor-prefixed model ID, such as anthropic/claude-opus-5 or openai/gpt-5.6-terra. xKiro performs its own failover and reports the model actually used.'
  }),
  Object.freeze({
    id: 'agentrouter',
    label: 'AgentRouter',
    wireFormat: 'openai-chat-completions',
    supportedWireFormats: Object.freeze(['openai-chat-completions', 'anthropic-messages']),
    baseUrl_openai: 'https://agentrouter.org/v1',
    baseUrl_anthropic: 'https://agentrouter.org',
    auth: Object.freeze({ type: 'bearer', header: 'Authorization' }),
    models: Object.freeze(['claude-opus-4-6', 'claude-haiku-4-5-20251001', 'gpt-5.5']),
    notes: 'Some non-whitelisted API clients are rejected by AgentRouter even with valid keys. The app reports that restriction distinctly.'
  }),
  Object.freeze({
    id: 'seekai',
    label: 'SeekAi',
    wireFormat: 'openai-chat-completions',
    supportedWireFormats: Object.freeze(['openai-chat-completions']),
    baseUrl: 'https://seekai.cc/v1',
    auth: Object.freeze({ type: 'bearer', header: 'Authorization' }),
    models: Object.freeze([]),
    unverifiedEndpoint: true,
    notes: 'Unverified endpoint — test before relying on it. The domain is very new with hidden WHOIS registration; start with a small top-up, not a large one, until you have confirmed it works and you trust it.'
  })
]);

export const PROVIDERS_BY_ID = Object.freeze(Object.fromEntries(PROVIDER_REGISTRY.map(provider => [provider.id, provider])));

export function getProvider(providerId) {
  return PROVIDERS_BY_ID[providerId] || null;
}

/** Returns the registered default URL for the selected transport. */
export function defaultBaseUrl(provider, wireFormat = provider.wireFormat) {
  if (wireFormat === 'anthropic-messages' && provider.baseUrl_anthropic) return provider.baseUrl_anthropic;
  if (wireFormat === 'openai-chat-completions' && provider.baseUrl_openai) return provider.baseUrl_openai;
  return provider.baseUrl || '';
}

export const WIRE_FORMAT_LABELS = Object.freeze({
  'gemini-native': 'Gemini native',
  'openai-chat-completions': 'OpenAI Chat Completions',
  'anthropic-messages': 'Anthropic Messages'
});

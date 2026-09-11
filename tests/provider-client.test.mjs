import assert from 'node:assert/strict';
import { PROVIDER_REGISTRY, defaultBaseUrl, getProvider } from '../lib/provider-registry.js';
import {
  buildGeminiRequest,
  buildOpenAIRequest,
  buildAnthropicRequest,
  REQUEST_BUILDERS,
  RESPONSE_PARSERS,
  parseGeminiResponse,
  parseOpenAIResponse,
  parseAnthropicResponse,
  validateMetadataOutput,
  validatedMetadataFromText
} from '../lib/provider-client.js';

const IMAGE = 'aGVsbG8=';
const MIME = 'image/png';
const SYSTEM = 'system';
const USER = 'user';

// Registry coverage: every slot maps to exactly one shared builder/parser.
assert.equal(PROVIDER_REGISTRY.length, 8);
for (const provider of PROVIDER_REGISTRY) {
  assert.ok(REQUEST_BUILDERS[provider.wireFormat], `${provider.id} has a request builder`);
  assert.ok(RESPONSE_PARSERS[provider.wireFormat], `${provider.id} has a response parser`);
  assert.ok(defaultBaseUrl(provider), `${provider.id} has a default endpoint`);
}
assert.equal(defaultBaseUrl(getProvider('xkiro'), 'anthropic-messages'), 'https://api.xkiro.com');
assert.equal(defaultBaseUrl(getProvider('agentrouter'), 'anthropic-messages'), 'https://agentrouter.org');

const gemini = buildGeminiRequest('https://example.test/v1beta/', 'g key', 'gemini-test', SYSTEM, USER, IMAGE, MIME);
assert.equal(gemini.url, 'https://example.test/v1beta/models/gemini-test:generateContent?key=g%20key');
assert.equal(gemini.init.headers.Authorization, undefined);
assert.deepEqual(JSON.parse(gemini.init.body), {
  system_instruction: { parts: [{ text: SYSTEM }] },
  contents: [{ role: 'user', parts: [{ text: USER }, { inline_data: { mime_type: MIME, data: IMAGE } }] }],
  generationConfig: { temperature: 0.4 }
});

const openai = buildOpenAIRequest('https://example.test/v1/', 'test-key', 'vision', SYSTEM, USER, IMAGE, MIME);
assert.equal(openai.url, 'https://example.test/v1/chat/completions');
assert.equal(openai.init.headers.Authorization, 'Bearer test-key');
assert.deepEqual(JSON.parse(openai.init.body).messages[1].content[1], { type: 'image_url', image_url: { url: `data:${MIME};base64,${IMAGE}` } });

const anthropic = buildAnthropicRequest('https://example.test/v1/', 'test-key', 'vision', SYSTEM, USER, IMAGE, MIME);
assert.equal(anthropic.url, 'https://example.test/v1/messages');
assert.equal(anthropic.init.headers['x-api-key'], 'test-key');
assert.equal(anthropic.init.headers['anthropic-version'], '2023-06-01');
assert.deepEqual(JSON.parse(anthropic.init.body).messages[0].content[1], { type: 'image', source: { type: 'base64', media_type: MIME, data: IMAGE } });

assert.equal(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: 'one' }, { text: 'two' }] } }] }), 'one\ntwo');
assert.equal(parseOpenAIResponse({ choices: [{ message: { content: 'answer' } }] }), 'answer');
assert.equal(parseAnthropicResponse({ content: [{ type: 'text', text: 'answer' }] }), 'answer');

const complete = {
  description: 'A factual description.',
  platforms: {
    adobe_stock: { title: 'Adobe title', keywords: ['one', 'two', 'three', 'four', 'five'] },
    shutterstock: { title: 'Shutterstock title', keywords: ['one', 'two', 'three', 'four', 'five', 'six', 'seven'] },
    istock_getty: { title: 'Getty title', keywords: ['one', 'two', 'three', 'four', 'five'] },
    freepik_vecteezy: { title: 'Freepik title', keywords: ['one', 'two', 'three', 'four', 'five'] }
  },
  category_suggestion: 'Nature',
  flags: []
};
assert.equal(validateMetadataOutput(complete).valid, true);
assert.deepEqual(validatedMetadataFromText('```json\n' + JSON.stringify(complete) + '\n```'), complete);
const incomplete = structuredClone(complete);
delete incomplete.platforms.shutterstock;
assert.equal(validateMetadataOutput(incomplete).valid, false);
assert.throws(() => validatedMetadataFromText(JSON.stringify(incomplete)), /Incomplete response, please regenerate/);

console.log('provider-client tests passed');

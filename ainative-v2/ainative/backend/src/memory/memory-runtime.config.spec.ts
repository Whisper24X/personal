import {
  applyOpenAiProcessEnvFallback,
  finalizeMemoryLlmModelIfBlank,
  mergeLlmTripleIfBlankFromPartial,
  loadMemoryRuntimeConfigFromEnv,
  type MemoryRuntimeConfigSnapshot,
} from './memory-runtime.config';

describe('memory-runtime LLM merge helpers', () => {
  const blankLlmSnap = (): MemoryRuntimeConfigSnapshot =>
    ({
      ...loadMemoryRuntimeConfigFromEnv(),
      llmProvider: 'openai-compatible',
      llmBaseUrl: '',
      llmApiKey: '',
      llmModel: '',
      llmHeaders: [],
      llmCommand: '',
    }) as MemoryRuntimeConfigSnapshot;

  it('should fill only blanks when merging LLM triple from partial', () => {
    let s = mergeLlmTripleIfBlankFromPartial(blankLlmSnap(), {
      llmProvider: 'cursor-agent',
      llmBaseUrl: 'https://x/v1',
      llmApiKey: 'k',
    });
    expect(s.llmProvider).toBe('cursor-agent');
    expect(s.llmBaseUrl).toBe('https://x/v1');
    expect(s.llmApiKey).toBe('k');
    expect(s.llmModel).toBe('');
    s = mergeLlmTripleIfBlankFromPartial(s, { llmModel: 'gpt-x' });
    expect(s.llmModel).toBe('gpt-x');
    s = mergeLlmTripleIfBlankFromPartial(
      mergeLlmTripleIfBlankFromPartial(blankLlmSnap(), { llmModel: 'm1' }),
      { llmModel: 'm2' },
    );
    expect(s.llmModel).toBe('m1');
  });

  it('should finalize provider-specific default models', () => {
    const anthropic = finalizeMemoryLlmModelIfBlank({
      ...blankLlmSnap(),
      llmProvider: 'anthropic',
    });
    const cursor = finalizeMemoryLlmModelIfBlank({
      ...blankLlmSnap(),
      llmProvider: 'cursor-agent',
    });

    expect(anthropic.llmModel).toBe('claude-sonnet-4-5');
    expect(cursor.llmModel).toBe('');
  });

  it('should apply OPENAI_* process env when MEMORY LLM fields are blank', () => {
    const prevUrl = process.env.OPENAI_BASE_URL;
    const prevKey = process.env.OPENAI_API_KEY;
    const prevMod = process.env.OPENAI_MODEL;
    try {
      process.env.OPENAI_BASE_URL = ' https://oa/test ';
      process.env.OPENAI_API_KEY = '';
      process.env.OPENAI_MODEL = '';
      let s = applyOpenAiProcessEnvFallback(blankLlmSnap());
      expect(s.llmBaseUrl.trim()).toBe('https://oa/test');
      process.env.OPENAI_BASE_URL = '';
      process.env.OPENAI_API_KEY = 'sk-env';
      s = mergeLlmTripleIfBlankFromPartial(blankLlmSnap(), {});
      s = applyOpenAiProcessEnvFallback(s);
      expect(s.llmApiKey).toBe('sk-env');
      s = finalizeMemoryLlmModelIfBlank(s);
      expect(s.llmModel).toBe('gpt-4o-mini');
    } finally {
      process.env.OPENAI_BASE_URL = prevUrl;
      process.env.OPENAI_API_KEY = prevKey;
      process.env.OPENAI_MODEL = prevMod;
    }
  });
});

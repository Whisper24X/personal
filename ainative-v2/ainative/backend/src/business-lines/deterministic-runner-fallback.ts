import type { RunnerOrchestrationConfig } from '../containers/runner-orchestration.types';
import type { RepoFacts, RunnerProtocol } from './repo-facts-collector';
import {
  buildDeterministicSelection,
  buildRunnerCandidateManifest,
  buildServiceCandidates,
} from './service-candidate-builder';
import { assembleRunnerConfigFromSelection } from './runner-config-assembler';

export interface FallbackGenerationResult {
  orchestration: RunnerOrchestrationConfig;
  warnings: string[];
  source: 'fallback';
  serviceProtocols: Record<string, RunnerProtocol>;
}

export function buildDeterministicConfig(
  facts: RepoFacts[],
): FallbackGenerationResult {
  const manifest = buildRunnerCandidateManifest(facts);
  const selection = buildDeterministicSelection(manifest);
  const warnings = [...manifest.warnings];

  if (!selection) {
    return {
      orchestration: { services: [] },
      warnings: [...warnings, 'No deterministic service selection available'],
      source: 'fallback',
      serviceProtocols: {},
    };
  }

  const assembled = assembleRunnerConfigFromSelection(manifest, selection);
  if (!assembled) {
    return {
      orchestration: { services: [] },
      warnings: [...warnings, 'Deterministic selection could not be assembled'],
      source: 'fallback',
      serviceProtocols: {},
    };
  }

  for (const candidate of buildServiceCandidates(facts)) {
    if (candidate.confidence < 0.7) {
      warnings.push(
        `${candidate.name}: low confidence static config (${candidate.confidence.toFixed(2)})`,
      );
    }
  }

  return {
    orchestration: assembled.orchestration,
    warnings: [...warnings, ...assembled.warnings],
    source: 'fallback',
    serviceProtocols: assembled.serviceProtocols,
  };
}

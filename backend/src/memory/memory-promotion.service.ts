import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryFactSignalEntity } from './infrastructure/persistence/memory-fact-signal.entity';
import { MemoryRuntimeConfigSnapshot } from './memory-runtime.config';
import type { MemoryFact } from './memory.types';

@Injectable()
export class MemoryPromotionService {
  constructor(
    @InjectRepository(MemoryFactSignalEntity)
    private readonly signalRepo: Repository<MemoryFactSignalEntity>,
  ) {}

  async filterFactsByPromotionGate(
    projectId: string,
    facts: MemoryFact[],
    config: MemoryRuntimeConfigSnapshot,
  ): Promise<MemoryFact[]> {
    const out: MemoryFact[] = [];
    for (const f of facts) {
      const ok = await this.passesGate(projectId, f, config);
      if (ok) {
        out.push(f);
      }
    }
    return out;
  }

  private async passesGate(
    projectId: string,
    fact: MemoryFact,
    config: MemoryRuntimeConfigSnapshot,
  ): Promise<boolean> {
    const row = await this.signalRepo.findOne({
      where: { projectId, dedupKey: fact.dedup_key },
    });
    const recall = row?.recallCount ?? 0;
    const dq = row?.distinctQueryCount ?? 0;

    if (config.promotionColdStart && recall === 0 && dq === 0) {
      return fact.confidence >= config.promotionScoreMin;
    }

    const score = this.scoreFact(fact, recall, dq, config);
    if (score < config.promotionScoreMin) {
      return false;
    }
    if (recall < config.promotionRecallMin) {
      return false;
    }
    if (dq < config.promotionDistinctQueriesMin) {
      return false;
    }
    return true;
  }

  private scoreFact(
    fact: MemoryFact,
    recall: number,
    distinctQueries: number,
    config: MemoryRuntimeConfigSnapshot,
  ): number {
    const rel = recall > 0 ? Math.min(1, recall / 5) : config.signalInitial;
    const freq = Math.min(1, recall / 5);
    const qd = Math.min(1, distinctQueries / 5);
    const rec = 0.5;
    const span = 0.5;
    const coh = 0.5;
    const tag =
      (fact.keywords_for_retrieval?.length ?? 0) /
      Math.max(1, fact.text.length / 40);

    return (
      rel * config.scoreWeightRelevance +
      freq * config.scoreWeightFrequency +
      qd * config.scoreWeightQueryDiversity +
      rec * config.scoreWeightRecency +
      span * config.scoreWeightSpanDays +
      coh * config.scoreWeightCohesion +
      Math.min(1, tag) * config.scoreWeightTagDensity
    );
  }

  async bumpSignalsAfterIngest(
    projectId: string,
    dedupKeys: string[],
  ): Promise<void> {
    for (const key of dedupKeys) {
      const existing = await this.signalRepo.findOne({
        where: { projectId, dedupKey: key },
      });
      if (existing) {
        await this.signalRepo.update(
          { id: existing.id },
          {
            recallCount: existing.recallCount + 1,
            distinctQueryCount: existing.distinctQueryCount + 1,
          },
        );
      } else {
        await this.signalRepo.save(
          this.signalRepo.create({
            projectId,
            dedupKey: key,
            recallCount: 1,
            distinctQueryCount: 1,
          }),
        );
      }
    }
  }
}

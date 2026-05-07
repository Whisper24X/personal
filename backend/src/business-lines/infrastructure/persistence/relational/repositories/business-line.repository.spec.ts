import { DataSource, EntityManager, Repository } from 'typeorm';
import { BusinessLineEntity } from '../entities/business-line.entity';
import { BusinessLineRelationalRepository } from './business-line.repository';

describe('BusinessLineRelationalRepository', () => {
  it('should permanently delete a business line graph in one transaction', async () => {
    const manager = {
      query: jest.fn((sql: string) => {
        if (sql.includes('FROM "projects"')) {
          return Promise.resolve([{ id: 'project-1' }]);
        }
        if (sql.includes('FROM "tasks"')) {
          return Promise.resolve([{ id: 'task-1' }]);
        }
        if (sql.includes('FROM "goals"')) {
          return Promise.resolve([{ id: 'goal-1' }]);
        }
        if (sql.includes('FROM "goal_plan_items"')) {
          return Promise.resolve([{ id: 'goal-plan-item-1' }]);
        }

        return Promise.resolve([]);
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((callback: (manager: EntityManager) => unknown) =>
        callback(manager),
      ),
    } as unknown as DataSource;
    const typeOrmRepository = {
      softDelete: jest.fn(),
    } as unknown as Repository<BusinessLineEntity>;
    const repository = new BusinessLineRelationalRepository(
      typeOrmRepository,
      dataSource,
    );

    await repository.remove('business-line-1');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(typeOrmRepository.softDelete).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(
      `DELETE FROM "business_lines" WHERE "id" = ANY($1::uuid[])`,
      [['business-line-1']],
    );
  });
});

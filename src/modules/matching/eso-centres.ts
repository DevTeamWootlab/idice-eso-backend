import { DataSource } from 'typeorm';
import { Match, MatchStatus } from './entities/match.entity';

export async function acceptedCentreIds(dataSource: DataSource, applicationId: string): Promise<string[]> {
  const matches = await dataSource.getRepository(Match).find({
    select: { id: true, institutionId: true, matchedAt: true },
    where: { applicationId, status: MatchStatus.ACCEPTED },
    order: { matchedAt: 'ASC' },
  });
  return matches.map((m) => m.institutionId);
}

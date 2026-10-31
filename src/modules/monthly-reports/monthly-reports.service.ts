import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MonthlyReport } from './entities/monthly-report.entity';
import { SubmitMonthlyReportDto } from './dto/submit-monthly-report.dto';
import { Application } from '@/modules/applications/entities/application.entity';
import { Match, MatchStatus } from '@/modules/matching/entities/match.entity';
import { ApplicationStatus } from '@/common/enums/application.enum';
import { User } from '@/modules/users/entities/user.entity';
import { StorageService } from '@/modules/storage/storage.service';
import { parseCloudinaryUrl } from '@/modules/storage/cloudinary.client';
import { resolveContentType, resolveFileName } from '@/common/utils/content-disposition';
import { dueDateFor, monthLabel, reportMonthOf, reportStatus } from './reporting-period';

const NOT_MATCHED = 'Monthly reporting opens once your application is matched to a Centre of Excellence.';

@Injectable()
export class MonthlyReportsService {
  constructor(
    @InjectRepository(MonthlyReport)
    private readonly reportRepo: Repository<MonthlyReport>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  private async esoContext(userId: string) {
    const application = await this.dataSource.getRepository(Application).findOne({
      where: { submittedByOrgId: userId, status: ApplicationStatus.MATCHED },
    });
    if (!application) throw new ForbiddenException(NOT_MATCHED);
    const match = await this.dataSource.getRepository(Match).findOne({
      where: { applicationId: application.id, status: MatchStatus.ACCEPTED },
      relations: { institution: true },
    });
    if (!match) throw new ForbiddenException(NOT_MATCHED);
    return { application, match };
  }

  private earliestMonthFor(match: Match, now: Date): string {
    return match.matchedAt ? reportMonthOf(new Date(match.matchedAt)) : reportMonthOf(now);
  }

  private async submitterNames(reports: MonthlyReport[]) {
    const ids = [...new Set(reports.map((r) => r.submittedById).filter(Boolean))];
    if (ids.length === 0) return new Map<string, string>();
    const users = await this.dataSource
      .getRepository(User)
      .find({ select: { id: true, fullName: true }, where: { id: In(ids) } });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  private toDto(report: MonthlyReport, names: Map<string, string> = new Map()) {
    const status = reportStatus(report.reportMonth, new Date(report.submittedAt));
    return {
      id: report.id,
      reportMonth: report.reportMonth,
      dueDate: dueDateFor(report.reportMonth),
      fileName: report.fileName ?? null,
      submittedAt: new Date(report.submittedAt).toISOString(),
      status,
      isNil: !!report.isNil,
      beneficiaryCount: report.isNil ? 0 : (report.beneficiaryCount ?? null),
      submittedByName: names.get(report.submittedById) ?? null,
    };
  }

  async getMine(userId: string, now: Date = new Date()) {
    const { application, match } = await this.esoContext(userId);
    const currentMonth = reportMonthOf(now);
    const reports = await this.reportRepo.find({
      where: { applicationId: application.id },
      order: { reportMonth: 'DESC' },
    });
    const current = reports.find((r) => r.reportMonth === currentMonth);
    const names = await this.submitterNames(reports);
    return {
      institution: { id: match.institution.id, name: match.institution.name, state: match.institution.state },
      currentMonth,
      currentDueDate: dueDateFor(currentMonth),
      currentStatus: reportStatus(currentMonth, current ? new Date(current.submittedAt) : null, now),
      earliestMonth: this.earliestMonthFor(match, now),
      items: reports.map((r) => this.toDto(r, names)),
    };
  }

  async submit(userId: string, dto: SubmitMonthlyReportDto, now: Date = new Date()) {
    const { application, match } = await this.esoContext(userId);
    const currentMonth = reportMonthOf(now);
    const earliestMonth = this.earliestMonthFor(match, now);
    if (dto.reportMonth > currentMonth) {
      throw new UnprocessableEntityException('You cannot submit a report for a month that has not started yet.');
    }
    if (dto.reportMonth < earliestMonth) {
      throw new UnprocessableEntityException(
        `Monthly reports start from ${monthLabel(earliestMonth)}, the month you were matched to your Centre of Excellence.`,
      );
    }
    const isNil = dto.isNil === true;
    if (!isNil && (!dto.fileUrl || !parseCloudinaryUrl(dto.fileUrl))) {
      throw new UnprocessableEntityException('The report file was not uploaded through the portal. Upload it again.');
    }

    const existing = await this.reportRepo.findOne({
      where: { applicationId: application.id, reportMonth: dto.reportMonth },
    });
    const report = existing ?? this.reportRepo.create({ applicationId: application.id, reportMonth: dto.reportMonth });
    report.institutionId = match.institutionId;
    report.isNil = isNil;
    report.fileUrl = isNil ? null : (dto.fileUrl ?? null);
    report.fileName = isNil ? null : (dto.fileName ?? '').trim();
    report.beneficiaryCount = isNil ? 0 : (dto.beneficiaryCount ?? null);
    report.submittedAt = now;
    report.submittedById = userId;
    const saved = await this.reportRepo.save(report);
    return this.toDto(saved, await this.submitterNames([saved]));
  }

  async listForAdmin(month?: string, now: Date = new Date()) {
    const target = month ?? reportMonthOf(now);
    const matches = await this.dataSource.getRepository(Match).find({
      where: { status: MatchStatus.ACCEPTED },
      relations: { application: true, institution: true },
    });
    const expected = matches.filter(
      (m) =>
        m.application?.status === ApplicationStatus.MATCHED &&
        this.earliestMonthFor(m, now) <= target,
    );
    const reports = await this.reportRepo.find({ where: { reportMonth: target } });
    const names = await this.submitterNames(reports);
    const byApplication = new Map(reports.map((r) => [r.applicationId, r]));

    const items = expected
      .map((m) => {
        const report = byApplication.get(m.applicationId) ?? null;
        return {
          applicationId: m.applicationId,
          applicationRef: m.application.applicationRef,
          esoName: m.application.organisationLegalName || 'Unnamed organisation',
          institution: { id: m.institution.id, name: m.institution.name, state: m.institution.state },
          status: reportStatus(target, report ? new Date(report.submittedAt) : null, now),
          report: report ? this.toDto(report, names) : null,
        };
      })
      .sort((a, b) => a.esoName.localeCompare(b.esoName));

    const count = (status: string) => items.filter((i) => i.status === status).length;
    return {
      month: target,
      dueDate: dueDateFor(target),
      summary: {
        expected: items.length,
        onTime: count('ON_TIME'),
        late: count('LATE'),
        due: count('DUE'),
        overdue: count('OVERDUE'),
      },
      items,
    };
  }

  async downloadMine(userId: string, id: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Monthly report not found');
    const application = await this.dataSource
      .getRepository(Application)
      .findOne({ where: { id: report.applicationId } });
    if (!application || application.submittedByOrgId !== userId) {
      throw new ForbiddenException('You do not have access to this report');
    }
    return this.download(id);
  }

  async download(id: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Monthly report not found');
    if (report.isNil || !report.fileUrl) throw new NotFoundException('This is a nil report, so it has no file.');
    const buffer = await this.storageService.readFile(report.fileUrl);
    return {
      buffer,
      fileName: resolveFileName(report.fileName, report.fileUrl),
      contentType: resolveContentType(null, report.fileName, report.fileUrl),
    };
  }
}

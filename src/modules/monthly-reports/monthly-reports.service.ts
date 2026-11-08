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
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { StorageService } from '@/modules/storage/storage.service';
import { parseCloudinaryUrl } from '@/modules/storage/cloudinary.client';
import { resolveContentType, resolveFileName } from '@/common/utils/content-disposition';
import {
  dueDateFor,
  monthLabel,
  reportingStartMonth,
  reportMonthOf,
  reportStatus,
  type MonthlyReportStatus,
} from './reporting-period';

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
    const matches = await this.dataSource.getRepository(Match).find({
      where: { applicationId: application.id, status: MatchStatus.ACCEPTED },
      relations: { institution: true },
      order: { matchedAt: 'ASC' },
    });
    if (matches.length === 0) throw new ForbiddenException(NOT_MATCHED);
    return { application, matches };
  }

  private earliestMonthFor(match: Match, now: Date): string {
    const matchedMonth = match.matchedAt ? reportMonthOf(new Date(match.matchedAt)) : reportMonthOf(now);
    const start = reportingStartMonth();
    return matchedMonth > start ? matchedMonth : start;
  }

  private async institutionsFor(reports: MonthlyReport[]) {
    const ids = [...new Set(reports.map((r) => r.institutionId).filter(Boolean))];
    if (ids.length === 0) return new Map<string, Institution>();
    const rows = await this.dataSource.getRepository(Institution).find({ where: { id: In(ids) } });
    return new Map(rows.map((i) => [i.id, i]));
  }

  private async submitterNames(reports: MonthlyReport[]) {
    const ids = [...new Set(reports.map((r) => r.submittedById).filter(Boolean))];
    if (ids.length === 0) return new Map<string, string>();
    const users = await this.dataSource
      .getRepository(User)
      .find({ select: { id: true, fullName: true }, where: { id: In(ids) } });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  private toDto(
    report: MonthlyReport,
    names: Map<string, string> = new Map(),
    institutions: Map<string, Institution> = new Map(),
  ) {
    const institution = institutions.get(report.institutionId) ?? null;
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
      institution: institution ? { id: institution.id, name: institution.name, state: institution.state } : null,
    };
  }

  async getMine(userId: string, now: Date = new Date()) {
    const { application, matches } = await this.esoContext(userId);
    const currentMonth = reportMonthOf(now);
    const reports = await this.reportRepo.find({
      where: { applicationId: application.id },
      order: { reportMonth: 'DESC' },
    });
    const names = await this.submitterNames(reports);
    const institutions = await this.institutionsFor(reports);
    const centres = matches.map((match) => {
      const current = reports.find((r) => r.reportMonth === currentMonth && r.institutionId === match.institutionId);
      const earliestMonth = this.earliestMonthFor(match, now);
      const currentStatus: MonthlyReportStatus =
        currentMonth < earliestMonth
          ? 'NOT_STARTED'
          : reportStatus(currentMonth, current ? new Date(current.submittedAt) : null, now);
      return {
        institution: { id: match.institution.id, name: match.institution.name, state: match.institution.state },
        currentStatus,
        earliestMonth,
      };
    });
    return {
      institution: centres[0].institution,
      currentMonth,
      currentDueDate: dueDateFor(currentMonth),
      currentStatus: centres[0].currentStatus,
      earliestMonth: centres.map((c) => c.earliestMonth).sort()[0],
      reportingStartMonth: reportingStartMonth(),
      items: reports.map((r) => this.toDto(r, names, institutions)),
      centres,
    };
  }

  async submit(userId: string, dto: SubmitMonthlyReportDto, now: Date = new Date()) {
    const { application, matches } = await this.esoContext(userId);
    const match = dto.institutionId
      ? matches.find((m) => m.institutionId === dto.institutionId)
      : matches.length === 1
        ? matches[0]
        : undefined;
    if (!match) {
      throw new UnprocessableEntityException(
        dto.institutionId
          ? 'You are not matched to that Centre of Excellence.'
          : 'Choose which Centre of Excellence this report is for.',
      );
    }
    const currentMonth = reportMonthOf(now);
    const earliestMonth = this.earliestMonthFor(match, now);
    if (dto.reportMonth > currentMonth) {
      throw new UnprocessableEntityException('You cannot submit a report for a month that has not started yet.');
    }
    if (dto.reportMonth < earliestMonth) {
      throw new UnprocessableEntityException(
        `Reports for ${match.institution.name} start from ${monthLabel(earliestMonth)}.`,
      );
    }
    const isNil = dto.isNil === true;
    if (!isNil && (!dto.fileUrl || !parseCloudinaryUrl(dto.fileUrl))) {
      throw new UnprocessableEntityException('The report file was not uploaded through the portal. Upload it again.');
    }

    const existing = await this.reportRepo.findOne({
      where: { applicationId: application.id, institutionId: match.institutionId, reportMonth: dto.reportMonth },
    });
    const report =
      existing ??
      this.reportRepo.create({
        applicationId: application.id,
        institutionId: match.institutionId,
        reportMonth: dto.reportMonth,
      });
    report.institutionId = match.institutionId;
    report.isNil = isNil;
    report.fileUrl = isNil ? null : (dto.fileUrl ?? null);
    report.fileName = isNil ? null : (dto.fileName ?? '').trim();
    report.beneficiaryCount = isNil ? 0 : (dto.beneficiaryCount ?? null);
    report.submittedAt = now;
    report.submittedById = userId;
    const saved = await this.reportRepo.save(report);
    return this.toDto(saved, await this.submitterNames([saved]), await this.institutionsFor([saved]));
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
    const institutions = await this.institutionsFor(reports);
    const byCentre = new Map(reports.map((r) => [`${r.applicationId}:${r.institutionId}`, r]));

    const items = expected
      .map((m) => {
        const report = byCentre.get(`${m.applicationId}:${m.institutionId}`) ?? null;
        return {
          applicationId: m.applicationId,
          applicationRef: m.application.applicationRef,
          esoName: m.application.organisationLegalName || 'Unnamed organisation',
          institution: { id: m.institution.id, name: m.institution.name, state: m.institution.state },
          status: reportStatus(target, report ? new Date(report.submittedAt) : null, now),
          report: report ? this.toDto(report, names, institutions) : null,
        };
      })
      .sort((a, b) => a.esoName.localeCompare(b.esoName) || a.institution.name.localeCompare(b.institution.name));

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
      reportingStartMonth: reportingStartMonth(),
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

import { Injectable, ConflictException, UnprocessableEntityException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { Beneficiary } from './entities/beneficiary.entity';
import { BeneficiarySkillsProfile } from './entities/beneficiary-skills-profile.entity';
import { BeneficiaryIncubationProfile } from './entities/beneficiary-incubation-profile.entity';
import { BeneficiaryAccelerationProfile } from './entities/beneficiary-acceleration-profile.entity';

import { Pillar, BeneficiaryStatus } from '@/common/enums/beneficiary.enum';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
// import { CryptoService } from '@/common/services/crypto.service';
import { GeoAllocationService } from './services/geo-allocation.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { encrypt, decrypt, hashDeterministic } from '@/common/utils/encryption';
import { ConfigService } from '@nestjs/config';
import { Institution } from '@/modules/institutions/entities/institution.entity';
import { ListBeneficiariesDto } from './dto/list-beneficiaries.dto';
import { UpdateBeneficiaryStatusDto } from './dto/update-beneficiary-status.dto';
import { canTransitionBeneficiary } from './beneficiary-lifecycle';
import {
  clampPagination,
  escapeLikePattern,
  totalPagesFor,
} from '@/modules/applications/admin-applications.query';
import { checkAcademicStatus } from './academic-status';
import {
  EsoBeneficiaryAccelerationDto,
  EsoBeneficiaryDto,
  EsoBeneficiaryIncubationDto,
  EsoBeneficiaryListDto,
  EsoBeneficiarySkillsDto,
} from './dto/eso-beneficiary-response.dto';
@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    // private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    private readonly geoAllocationService: GeoAllocationService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Handles public intake registration with strict NDPA security & conditional validation
   */
  async listForAdmin(query: ListBeneficiariesDto) {
    const { page, limit, skip } = clampPagination(query.page, query.limit);

    const qb = this.beneficiaryRepo
      .createQueryBuilder('b')
      .leftJoin('b.assignedInstitution', 'institution')
      .select([
        'b.id',
        'b.referenceId',
        'b.fullName',
        'b.gender',
        'b.email',
        'b.phoneNumber',
        'b.pillar',
        'b.status',
        'b.stateOfResidence',
        'b.assignedInstitutionId',
        'b.createdAt',
      ])
      .addSelect(['institution.id', 'institution.name', 'institution.state']);

    if (query.status) qb.andWhere('b.status = :status', { status: query.status });
    if (query.pillar) qb.andWhere('b.pillar = :pillar', { pillar: query.pillar });
    if (query.institutionId) {
      qb.andWhere('b.assignedInstitutionId = :institutionId', {
        institutionId: query.institutionId,
      });
    }
    const term = query.search?.trim();
    if (term) {
      qb.andWhere(
        '(b.fullName ILIKE :term OR b.email ILIKE :term OR b.referenceId ILIKE :term)',
        { term: `%${escapeLikePattern(term)}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('b.createdAt', 'DESC')
      .addOrderBy('b.id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getManyAndCount();

    return { items, total, page, limit, totalPages: totalPagesFor(total, limit) };
  }

  /**
   * A matched ESO's own view of their cohort: only beneficiaries actually ALLOCATED
   * (by a SYSADMIN, via updateStatusForAdmin) to the Centre of Excellence this ESO is
   * matched to — never everyone who merely typed that CoE as a preference at intake,
   * and never NIN (not selected off the entity by default) or other KYC fields an ESO
   * doesn't need to run training/incubation/acceleration.
   *
   * The caller (ApplicationsService.getApplicantBeneficiaries) is responsible for
   * resolving institutionId from the ESO's own committed Match record — this method
   * trusts whatever institutionId it is given, so it must never be called with one
   * sourced from client input.
   */
  async listForEso(institutionId: string): Promise<EsoBeneficiaryListDto> {
    const institution = await this.dataSource.getRepository(Institution).findOne({
      where: { id: institutionId },
    });
    if (!institution) throw new NotFoundException('Institution not found');

    const beneficiaries = await this.beneficiaryRepo.find({
      where: { assignedInstitutionId: institutionId, status: BeneficiaryStatus.ALLOCATED },
      relations: { skillsProfile: true, incubationProfile: true, accelerationProfile: true },
      order: { allocatedAt: 'DESC' },
    });

    return {
      institution: { id: institution.id, name: institution.name, state: institution.state },
      items: beneficiaries.map((b) => this.toEsoBeneficiaryDto(b)),
    };
  }

  private toEsoBeneficiaryDto(b: Beneficiary): EsoBeneficiaryDto {
    const skillsProfile: EsoBeneficiarySkillsDto | null = b.skillsProfile
      ? {
          preferredHubType: b.skillsProfile.preferredHubType,
          skillTier: b.skillsProfile.skillTier,
          specificSkillArea: b.skillsProfile.specificSkillArea,
          priorExperience: b.skillsProfile.priorExperience ?? null,
          highestEducationLevel: b.skillsProfile.highestEducationLevel,
          ownsPersonalDevice: b.skillsProfile.ownsPersonalDevice,
          hasReliableInternet: b.skillsProfile.hasReliableInternet,
          portfolioLink: b.skillsProfile.portfolioLink ?? null,
        }
      : null;

    const incubationProfile: EsoBeneficiaryIncubationDto | null = b.incubationProfile
      ? {
          ventureName: b.incubationProfile.ventureName ?? null,
          sectorFocus: b.incubationProfile.sectorFocus,
          problemStatement: b.incubationProfile.problemStatement,
          proposedSolution: b.incubationProfile.proposedSolution,
          targetCustomer: b.incubationProfile.targetCustomer,
          currentStage: b.incubationProfile.currentStage,
          teamSizeAndRoles: b.incubationProfile.teamSizeAndRoles,
          technologyPlatform: b.incubationProfile.technologyPlatform ?? null,
          supportNeeded: b.incubationProfile.supportNeeded ?? null,
          availableForFullDuration: b.incubationProfile.availableForFullDuration,
        }
      : null;

    const accelerationProfile: EsoBeneficiaryAccelerationDto | null = b.accelerationProfile
      ? {
          registeredBusinessName: b.accelerationProfile.registeredBusinessName,
          cacRegistrationNumber: b.accelerationProfile.cacRegistrationNumber,
          yearFounded: b.accelerationProfile.yearFounded,
          sector: b.accelerationProfile.sector,
          employeeCount: b.accelerationProfile.employeeCount ?? null,
          estimatedMonthlyRevenueNgn: b.accelerationProfile.estimatedMonthlyRevenueNgn ?? null,
          keyTraction: b.accelerationProfile.keyTraction ?? null,
          hasRaisedExternalFunding: b.accelerationProfile.hasRaisedExternalFunding,
          fundingSourceDetails: b.accelerationProfile.fundingSourceDetails ?? null,
          primaryGrowthChallenge: b.accelerationProfile.primaryGrowthChallenge,
          supportNeeded: b.accelerationProfile.supportNeeded ?? null,
          twelveMonthGrowthTarget: b.accelerationProfile.twelveMonthGrowthTarget ?? null,
          liveProductUrl: b.accelerationProfile.liveProductUrl ?? null,
          hasPitchDeck: !!b.accelerationProfile.pitchDeckStorageKey,
        }
      : null;

    return {
      id: b.id,
      referenceId: b.referenceId,
      fullName: b.fullName,
      gender: b.gender,
      email: b.email,
      phoneNumber: b.phoneNumber,
      isNeet: b.isNeet,
      isCurrentStudent: b.isCurrentStudent,
      isRecentGraduate: b.isRecentGraduate,
      academicStatus: b.academicStatus ?? null,
      institutionName: b.institutionName ?? null,
      studentMatricNumber: b.studentMatricNumber ?? null,
      pwdAssistiveRequirement: b.pwdAssistiveRequirement ?? null,
      stateOfOrigin: b.stateOfOrigin,
      stateOfResidence: b.stateOfResidence,
      lga: b.lga,
      pillar: b.pillar,
      status: b.status,
      allocatedAt: b.allocatedAt ? new Date(b.allocatedAt).toISOString() : null,
      statementOfPurpose: b.statementOfPurpose ?? null,
      skillsProfile,
      incubationProfile,
      accelerationProfile,
    };
  }

  async updateStatusForAdmin(id: string, dto: UpdateBeneficiaryStatusDto) {
    const beneficiary = await this.beneficiaryRepo.findOne({ where: { id } });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');

    if (!canTransitionBeneficiary(beneficiary.status, dto.status)) {
      throw new BadRequestException(
        `Cannot move a beneficiary from ${beneficiary.status} to ${dto.status}`,
      );
    }

    let allocatedInstitutionName: string | null = null;
    if (dto.status === BeneficiaryStatus.ALLOCATED) {
      const institutionId = dto.institutionId ?? beneficiary.assignedInstitutionId;
      if (!institutionId) {
        throw new BadRequestException(
          'institutionId is required to allocate a beneficiary',
        );
      }
      const institution = await this.dataSource
        .getRepository(Institution)
        .findOne({ where: { id: institutionId, isActive: true } });
      if (!institution) {
        throw new BadRequestException('Institution not found or inactive');
      }
      if (institution.beneficiaryCapacity > 0) {
        const allocated = await this.beneficiaryRepo.count({
          where: {
            assignedInstitutionId: institutionId,
            status: BeneficiaryStatus.ALLOCATED,
          },
        });
        if (allocated >= institution.beneficiaryCapacity) {
          throw new ConflictException(
            `${institution.name} is at capacity (${institution.beneficiaryCapacity})`,
          );
        }
      }
      beneficiary.assignedInstitutionId = institutionId;
      allocatedInstitutionName = institution.name;
      beneficiary.allocatedAt = new Date();
    } else if (dto.institutionId) {
      throw new BadRequestException(
        'institutionId is only accepted when allocating',
      );
    }

    beneficiary.status = dto.status;
    await this.beneficiaryRepo.save(beneficiary);

    if (allocatedInstitutionName) {
      try {
        await this.notificationsService.sendBeneficiaryAllocated(
          beneficiary.email,
          beneficiary.phoneNumber,
          beneficiary.referenceId,
          allocatedInstitutionName,
        );
      } catch {
        // The allocation is already saved; a failed email must not undo or fail it.
      }
    }

    const updated = await this.beneficiaryRepo.findOneOrFail({
      where: { id },
      relations: { assignedInstitution: true },
    });
    return {
      id: updated.id,
      referenceId: updated.referenceId,
      fullName: updated.fullName,
      gender: updated.gender,
      email: updated.email,
      phoneNumber: updated.phoneNumber,
      pillar: updated.pillar,
      status: updated.status,
      stateOfResidence: updated.stateOfResidence,
      assignedInstitutionId: updated.assignedInstitutionId ?? null,
      assignedInstitution: updated.assignedInstitution
        ? {
            id: updated.assignedInstitution.id,
            name: updated.assignedInstitution.name,
            state: updated.assignedInstitution.state,
          }
        : null,
      createdAt: updated.createdAt,
    };
  }

  async registerIntake(dto: CreateBeneficiaryDto): Promise<Beneficiary> {
    // ---- 1. Server-Side Conditional Pillar Payload Rules ----
    this.validatePillarPayloads(dto);
    const statusProblem = checkAcademicStatus(dto);
    if (statusProblem) throw new BadRequestException(statusProblem);

    // ---- 2. Email & NIN Deduplication Check ----
    const existingEmail = await this.beneficiaryRepo.findOne({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existingEmail) {
      throw new ConflictException(
        'An application with this email address has already been submitted.',
      );
    }

    // Encrypt NIN at rest and compute deterministic hash for unique lookup
    const nin_hash = this.configService.getOrThrow<string>('nin.hashKey');
    const hashedNin = hashDeterministic(dto.nin, nin_hash);

    const encryptedNin = encrypt(
      dto.nin,
      this.configService.getOrThrow<string>('nin.encryptionKey'),
    );

    const existingNin = await this.beneficiaryRepo.findOne({
      where: { ninHash: hashedNin },
    });
    if (existingNin) {
      throw new ConflictException(
        'An application with this National Identification Number (NIN) has already been submitted.',
      );
    }

    // ---- 3. Geo/Hub Allocation ----
    const assignedInstitutionId = await this.geoAllocationService.allocateHub(
      dto.preferredInstitutionId,
      dto.stateOfResidence,
    );

    // ---- 4. Reference ID Generation ----
    const referenceId = `iDICE-BEN-2026-${randomUUID().slice(0, 8).toUpperCase()}`;

    // ---- 5. Database Transaction Execution ----
    const beneficiary = await this.dataSource.transaction(async (manager) => {
      // Build core beneficiary entity
      const beneficiary = manager.create(Beneficiary, {
        referenceId,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender,
        phoneNumber: dto.phoneNumber,
        email: dto.email.toLowerCase().trim(),
        nin: encryptedNin,
        ninHash: hashedNin,
        pwdAssistiveRequirement: dto.pwdAssistiveRequirement,
        isNeet: dto.isNeet,
        isCurrentStudent: dto.isCurrentStudent,
        institutionName: dto.institutionName,
        studentMatricNumber: dto.studentMatricNumber,
        isRecentGraduate: dto.isRecentGraduate,
        academicStatus: dto.academicStatus,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactRelationship: dto.emergencyContactRelationship,
        emergencyContactPhone: dto.emergencyContactPhone,
        stateOfOrigin: dto.stateOfOrigin,
        stateOfResidence: dto.stateOfResidence,
        lga: dto.lga,
        homeAddress: dto.homeAddress,
        pillar: dto.pillar,
        preferredInstitutionId: dto.preferredInstitutionId,
        assignedInstitutionId,
        statementOfPurpose: dto.statementOfPurpose,
        ndprConsentGiven: dto.ndprConsentGiven,
        codeOfConductAccepted: dto.codeOfConductAccepted,
        signedAt: new Date(),
        status: BeneficiaryStatus.SUBMITTED,
      });

      const savedBeneficiary = await manager.save(beneficiary);

      // Save corresponding dynamic pillar profile
      if (dto.pillar === Pillar.SKILLS && dto.skillsProfile) {
        const skillsProfile = manager.create(BeneficiarySkillsProfile, {
          ...dto.skillsProfile,
          beneficiaryId: savedBeneficiary.id,
        });
        await manager.save(skillsProfile);
      } else if (dto.pillar === Pillar.INCUBATION && dto.incubationProfile) {
        const incubationProfile = manager.create(BeneficiaryIncubationProfile, {
          ...dto.incubationProfile,
          beneficiaryId: savedBeneficiary.id,
        });
        await manager.save(incubationProfile);
      } else if (
        dto.pillar === Pillar.ACCELERATION &&
        dto.accelerationProfile
      ) {
        const accelerationProfile = manager.create(
          BeneficiaryAccelerationProfile,
          {
            ...dto.accelerationProfile,
            beneficiaryId: savedBeneficiary.id,
          },
        );
        await manager.save(accelerationProfile);
      }

      // Re-fetch complete beneficiary with relations
      return await manager.findOneOrFail(Beneficiary, {
        where: { id: savedBeneficiary.id },
        relations: {
          skillsProfile: true,
          incubationProfile: true,
          accelerationProfile: true,
          preferredInstitution: true,
        },
      });
    });

    // Sent after the transaction commits, not inside it — a confirmation email
    // failing (e.g. the mail provider being briefly unavailable) shouldn't roll back
    // an otherwise-successful registration. Previously this was never called at all,
    // so a beneficiary got no confirmation of any kind beyond the frontend's
    // client-side success screen.
    try {
      await this.notificationsService.sendBeneficiaryConfirmation(
        beneficiary.email,
        beneficiary.phoneNumber,
        beneficiary.referenceId,
      );
    } catch {
      // Swallowed deliberately — the registration itself already succeeded and is
      // committed; a notification failure shouldn't turn into a 500 for the
      // applicant after their data was saved correctly.
    }

    return beneficiary;
  }

  /**
   * Pitch Deck document upload prior to public intake form submission
   */
  async uploadPitchDeck(
    file: Express.Multer.File,
  ): Promise<{ storageKey: string }> {
    if (!file) throw new BadRequestException('Pitch deck file is required');
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'Pitch deck file size must not exceed 10MB',
      );
    }

    const storageKey = await this.storageService.uploadFile(
      file.buffer,
      'beneficiaries/pitch-decks',
      file.originalname,
    );

    return { storageKey };
  }

  private validatePillarPayloads(dto: CreateBeneficiaryDto): void {
    if (dto.pillar === Pillar.SKILLS) {
      if (!dto.skillsProfile) {
        throw new UnprocessableEntityException(
          'skillsProfile is required when Pillar is set to SKILLS.',
        );
      }
      if (dto.incubationProfile || dto.accelerationProfile) {
        throw new UnprocessableEntityException(
          'Cannot submit incubationProfile or accelerationProfile when Pillar is SKILLS.',
        );
      }
    }

    if (dto.pillar === Pillar.INCUBATION) {
      if (!dto.incubationProfile) {
        throw new UnprocessableEntityException(
          'incubationProfile is required when Pillar is set to INCUBATION.',
        );
      }
      if (dto.skillsProfile || dto.accelerationProfile) {
        throw new UnprocessableEntityException(
          'Cannot submit skillsProfile or accelerationProfile when Pillar is INCUBATION.',
        );
      }
    }

    if (dto.pillar === Pillar.ACCELERATION) {
      if (!dto.accelerationProfile) {
        throw new UnprocessableEntityException(
          'accelerationProfile is required when Pillar is set to ACCELERATION.',
        );
      }
      if (dto.skillsProfile || dto.incubationProfile) {
        throw new UnprocessableEntityException(
          'Cannot submit skillsProfile or incubationProfile when Pillar is ACCELERATION.',
        );
      }

      const { liveProductUrl, pitchDeckStorageKey } = dto.accelerationProfile;
      if (!liveProductUrl && !pitchDeckStorageKey) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message:
            'Acceleration applications require either a valid Live Product URL or a Pitch Deck document.',
        });
      }
    }
  }
}

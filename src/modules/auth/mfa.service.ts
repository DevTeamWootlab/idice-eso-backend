import { BadRequestException, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { authenticator } from '@otplib/preset-default';
// import { generate, verify } from 'otplib';
import * as qrcode from 'qrcode';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';

import { MfaSecret } from './entities/mfa-secret.entity';
import { UsersService } from '../users/users.service';
import { encrypt, decrypt } from '@/common/utils/encryption';
import { readBackupHashes } from './mfa-utils';

// Accept the code from the neighbouring 30-second step too, so a normal few seconds of clock
// difference between the phone and the server does not reject a correct code.
authenticator.options = { ...authenticator.options, window: 1 };

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    @InjectRepository(MfaSecret)
    private readonly mfaSecretRepo: Repository<MfaSecret>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async generateSetup(userId: string, email: string) {
    const user = await this.usersService.findById(userId);
    if (user?.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled for this account');
    }

    // 1. Generate a valid Base32 secret string automatically
    const encryptionKey = this.configService.getOrThrow<string>('mfa.encryptionKey');
    const issuer = this.configService.getOrThrow<string>('mfa.issuer');

    // Setup can be opened many times before it is confirmed (a refresh, a second sign-in). Issuing a
    // new secret each time left the authenticator app holding stale entries that no longer matched
    // the database, so every code — and the backup codes — appeared to fail. An unconfirmed secret
    // is therefore reused until enrolment is completed.
    const pending = await this.mfaSecretRepo.findOne({ where: { userId: userId } as any });
    let secret = '';
    if (pending) {
      try {
        secret = decrypt(pending.encryptedSecret, encryptionKey);
      } catch {
        secret = '';
      }
    }
    if (!secret) {
      secret = authenticator.generateSecret();
      await this.mfaSecretRepo.delete({ userId: userId } as any);
      await this.mfaSecretRepo.save(
        this.mfaSecretRepo.create({
          userId,
          encryptedSecret: encrypt(secret, encryptionKey),
          backupCodes: [],
        } as any),
      );
    }
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
    return { qrCodeDataUrl, manualEntryKey: secret };
  }
  async enable(userId: string, code: string) {
    const record = await this.mfaSecretRepo.findOne({
      where: { userId: userId } as any,
    });
    if (!record) {
      throw new BadRequestException(
        'No MFA setup in progress — call setup first',
      );
    }

    const encryptionKey =
      this.configService.getOrThrow<string>('mfa.encryptionKey');
    const secret = decrypt(record.encryptedSecret, encryptionKey);

    const valid = authenticator.verify({ token: (code ?? '').trim(), secret });
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c)),
    );

    record.backupCodes = hashedCodes;
    await this.mfaSecretRepo.save(record);
    await this.usersService.setMfaEnabled(userId, true);

    return { backupCodes };
  }

  //   async verifyCode(userId: string, code: string): Promise<boolean> {
  //     const record = await this.mfaSecretRepo.findOne({
  //       where: { userId: userId } as any,
  //     });
  //     if (!record) return false;

  //     const encryptionKey =
  //       this.configService.getOrThrow<string>('mfa.encryptionKey');
  //     const secret = decrypt(record.encryptedSecret, encryptionKey);

  //     if (authenticator.verify({ token: code, secret })) {
  //       return true;
  //     }

  //     return this.tryConsumeBackupCode(record, code);
  //   }
  async verifyCode(userId: string, code: string): Promise<boolean> {
    // 1. Instantly reject if the code is missing or malformed to protect downstream cryptography layers
    if (!code || typeof code !== 'string') {
      return false;
    }

    const record = await this.mfaSecretRepo.findOne({
      where: { userId: userId } as any,
    });
    if (!record) {
      this.logger.warn(
        `MFA verification failed for user ${userId}: no authenticator secret on file (flagged as enrolled but never enrolled, or reset)`,
      );
      return false;
    }

    const encryptionKey =
      this.configService.getOrThrow<string>('mfa.encryptionKey');
    const secret = decrypt(record.encryptedSecret, encryptionKey);

    // Tolerate stray whitespace, and backup codes typed in lower case (they are issued upper-case).
    const submitted = code.trim();
    if (authenticator.verify({ token: submitted, secret })) {
      return true;
    }
    // console.log('DEBUG — secret in DB:', secret);
    // console.log('DEBUG — code received:', code);
    // console.log(
    //   'DEBUG — expected code right now:',
    //   authenticator.generate(secret),
    // );

    const usedBackup = await this.tryConsumeBackupCode(record, submitted.toUpperCase());
    if (!usedBackup) {
      // Reasons only — never the codes or the secret.
      this.logger.warn(
        `MFA verification failed for user ${userId}: authenticator code did not match and none of the ${readBackupHashes(record.backupCodes).length} backup code(s) on file matched`,
      );
    }
    return usedBackup;
  }

  async disable(userId: string) {
    await this.mfaSecretRepo.delete({ userId: userId } as any);
    await this.usersService.setMfaEnabled(userId, false);
  }

  async regenerateBackupCodes(userId: string) {
    const record = await this.mfaSecretRepo.findOne({
      where: { userId: userId } as any,
    });
    if (!record) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    const backupCodes = this.generateBackupCodes();
    record.backupCodes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c)),
    );
    await this.mfaSecretRepo.save(record);

    return { backupCodes };
  }

  //   private async tryConsumeBackupCode(
  //     record: MfaSecret,
  //     code: string,
  //   ): Promise<boolean> {
  //     for (let i = 0; i < record.backupCodes.length; i++) {
  //       if (await argon2.verify(record.backupCodes[i], code)) {
  //         record.backupCodes.splice(i, 1);
  //         await this.mfaSecretRepo.save(record);
  //         return true;
  //       }
  //     }
  //     return false;
  //   }
  private async tryConsumeBackupCode(
    record: MfaSecret,
    code: string,
  ): Promise<boolean> {
    if (
      !code ||
      typeof code !== 'string' ||
      readBackupHashes(record.backupCodes).length === 0
    ) {
      return false;
    }

    const hashes = readBackupHashes(record.backupCodes);
    for (let i = 0; i < hashes.length; i++) {
      const hash = hashes[i];

      if (!hash || typeof hash !== 'string' || !hash.startsWith('$argon2')) {
        continue;
      }

      try {
        if (await argon2.verify(hash, code.trim())) {
          hashes.splice(i, 1);
          record.backupCodes = hashes;
          await this.mfaSecretRepo.save(record);
          return true;
        }
      } catch (err) {
        console.warn(
          `Security Log: Bypassed cryptographic parsing anomaly.`,
          err,
        );
        continue;
      }
    }

    return false;
  }
  private generateBackupCodes(count = 10): string[] {
    return Array.from({ length: count }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );
  }
}

// for (let i = 0; i < codes.length; i++) {
//   const hashedCode = codes[i];
//   if (!hashedCode || typeof hashedCode !== 'string') continue; // skip anything malformed

//   if (await argon2.verify(hashedCode, code)) {
//     codes.splice(i, 1);
//     record.backupCodes = codes;
//     await this.mfaSecretRepo.save(record);
//     return true;
//   }
// }
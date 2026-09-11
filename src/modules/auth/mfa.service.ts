import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

@Injectable()
export class MfaService {
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
    const secret = authenticator.generateSecret();
    const issuer = this.configService.getOrThrow<string>('mfa.issuer');

    // 2. Generate a valid URL key for authenticator app registration
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    const encryptionKey =
      this.configService.getOrThrow<string>('mfa.encryptionKey');
    const encryptedSecret = encrypt(secret, encryptionKey);

    await this.mfaSecretRepo.delete({ userId: userId } as any);
    await this.mfaSecretRepo.save(
      this.mfaSecretRepo.create({
        userId,
        encryptedSecret,
        backupCodes: [],
      } as any),
    );

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

    const valid = authenticator.verify({ token: code, secret });
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
    if (!record) return false;

    const encryptionKey =
      this.configService.getOrThrow<string>('mfa.encryptionKey');
    const secret = decrypt(record.encryptedSecret, encryptionKey);

    if (authenticator.verify({ token: code, secret })) {
      return true;
    }
    // console.log('DEBUG — secret in DB:', secret);
    // console.log('DEBUG — code received:', code);
    // console.log(
    //   'DEBUG — expected code right now:',
    //   authenticator.generate(secret),
    // );

    return this.tryConsumeBackupCode(record, code);
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
      !record.backupCodes ||
      record.backupCodes.length === 0
    ) {
      return false;
    }

    for (let i = 0; i < record.backupCodes.length; i++) {
      const hash = record.backupCodes[i];

      if (!hash || typeof hash !== 'string' || !hash.startsWith('$argon2')) {
        continue;
      }

      try {
        if (await argon2.verify(hash, code.trim())) {
          record.backupCodes.splice(i, 1);
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
import { Role } from '@/common/enums/role.enum';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
  sessionId?: string;
}

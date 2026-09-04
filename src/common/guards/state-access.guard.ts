import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@/common/enums/role.enum';

// Enforces TC-VAL-01 — a validator only ever sees applications/records
// tied to their own assigned state. Compares against a `:state` route param
// or a `state` query param, whichever the route uses.
@Injectable()
export class StateAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.role !== Role.VALIDATOR) return true; // only restricts validators

    const requestedState = request.params?.state || request.query?.state;
    if (!requestedState) return true; // no state filter on this route, nothing to check

    if (requestedState !== user.assignedState) {
      throw new ForbiddenException(
        'You can only access records for your assigned state',
      );
    }
    return true;
  }
}

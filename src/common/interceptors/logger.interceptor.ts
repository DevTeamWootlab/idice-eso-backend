import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  constructor() { }
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userAgenet = request.get("user-agent") || "";
    const { ip, method, path: url } = request;
    this.logger.log(
      `method: ${method}, url: ${url}, userAgent: ${userAgenet}, ip: ${ip}, class: ${context.getClass().name
      }, startTime: ${new Date()}, functionInClassBeingCalled: ${context.getHandler().name} `,
    );
    // const now = Date.now();
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        this.logger
          .log(`method: ${method}, url: ${url}, userAgent: ${userAgenet}, ip: ${ip}, status: ${statusCode}, endTime: ${new Date()}
          `);
      }),
    );
  }
}

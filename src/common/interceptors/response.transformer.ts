import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface CtxRes {
  status: boolean;
  timestamp: number;
  data: any;
}

export type Response = CtxRes;

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response | StreamableFile | Buffer> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response | StreamableFile | Buffer> {
    return next.handle().pipe(
      map((res) => {
        if (res instanceof StreamableFile || Buffer.isBuffer(res)) return res;
        const response = context.switchToHttp().getResponse();
        if (response?.headersSent) return res;
        return {
          status: true,
          timestamp: Date.now(),
          data: res,
        };
      }),
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * BranchScopeInterceptor
 *
 * Automatically injects `branchId` into query params for users who have a
 * branchId on their JWT. This means a Branch Manager with branchId = "LHR-123"
 * will ONLY ever see Lahore data — they cannot pass a different branchId in
 * the query string to peek at another branch.
 *
 * SUPER_ADMIN and OWNER have no branchId on their token → they see all branches
 * and can filter by any branchId they choose.
 */
@Injectable()
export class BranchScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.branchId) {
      // Force the branchId for every scoped user — overrides any query param they send
      request.query.branchId = user.branchId;

      // Also inject into body for POST/PATCH requests that create records
      if (request.body && typeof request.body === 'object') {
        // Only inject if the body has a branchId field (not for all routes)
        if ('branchId' in request.body || request.method === 'POST') {
          request.body.branchId = user.branchId;
        }
      }
    }

    return next.handle();
  }
}

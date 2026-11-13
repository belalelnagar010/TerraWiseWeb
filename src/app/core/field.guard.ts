import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FieldStateService } from './field-state.service';

/** Results needs a selected field; otherwise bounce back to the map. */
export const fieldSelectedGuard: CanActivateFn = () => {
  const field = inject(FieldStateService);
  const router = inject(Router);
  if (field.lat() !== null) return true;
  return router.createUrlTree(['/field']);
};

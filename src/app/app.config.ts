import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    importProvidersFrom(
      MatInputModule,
      MatButtonModule,
      MatListModule,
      MatIconModule,
      MatCardModule
    )
  ]
};

import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { MessageKey } from './messages';
import { I18n } from './i18n';

/** Título de la pestaña ("Hoy · Hecho"), que también se actualiza al cambiar de idioma. */
@Injectable()
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18n);
  private readonly current = signal<{ key?: MessageKey; tag?: string }>({});

  constructor() {
    super();
    effect(() => {
      const { key, tag } = this.current();
      const name = tag ? `#${tag}` : key ? this.i18n.t(key) : null;
      this.title.setTitle(name ? `${name} · Hecho` : 'Hecho');
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    this.current.set({
      key: route.data['titleKey'] as MessageKey | undefined,
      tag: route.paramMap.get('tag') ?? undefined,
    });
  }
}

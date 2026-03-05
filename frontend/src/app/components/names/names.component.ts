import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@app/services/api.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { SeoService } from '@app/services/seo.service';
import { NameAliveStatus, NameRecord, NamesResponse } from '@interfaces/node-api.interface';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, from, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, mergeMap, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-names',
  templateUrl: './names.component.html',
  styleUrls: ['./names.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NamesComponent implements OnInit, OnDestroy {
  readonly maxRows = 100;
  readonly aliveProbeTimeoutMs = 4000;
  readonly domainLabelRegex = /^[a-z0-9](?:[a-z0-9-]{0,253}[a-z0-9])?$/;

  names: NameRecord[] = [];
  totalRegisteredNames: number | null = null;
  nameAliveStatus: { [name: string]: NameAliveStatus | undefined } = {};
  query = '';
  currentQuery = '';
  isLoading = true;
  error: string | null = null;
  aliveCheckRequestId = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly apiService: ApiService,
    private readonly cd: ChangeDetectorRef,
    private readonly seoService: SeoService,
    private readonly ogService: OpenGraphService,
    private readonly relativeUrlPipe: RelativeUrlPipe,
  ) {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@names.page-title:Namecoin Names`);
    this.seoService.setDescription($localize`:@@names.page-description:Browse Namecoin domain names and see registration height, expiration height, and current address ownership.`);
    this.ogService.setManualOgImage('recent-blocks.jpg');

    this.route.queryParamMap
      .pipe(
        map((params) => (params.get('q') || '').trim()),
        distinctUntilChanged(),
        tap((query) => {
          this.currentQuery = query;
          this.query = query;
          this.isLoading = true;
          this.error = null;
          this.totalRegisteredNames = null;
          this.nameAliveStatus = {};
          this.cd.markForCheck();
        }),
        switchMap((query) => this.apiService.listNames$({
          query: query || undefined,
          prefix: query ? undefined : 'd/',
          count: this.maxRows,
        }).pipe(
          map((response) => response),
          catchError((httpError: HttpErrorResponse) => {
            const details = this.extractErrorDetails(httpError);
            const statusText = httpError?.status ? `HTTP ${httpError.status}` : 'HTTP error';
            this.error = query
              ? `Failed to load names for this search (${statusText}). ${details}`
              : `Failed to load names list (${statusText}). ${details}`;
            return of({
              query: query || null,
              prefix: 'd/',
              start: 'd/',
              count: this.maxRows,
              totalRegisteredNames: null,
              items: [],
            } as NamesResponse);
          })
        )),
        takeUntil(this.destroy$),
      )
      .subscribe((response) => {
        this.totalRegisteredNames = response?.totalRegisteredNames ?? response?.totalDomainNames ?? null;
        this.names = (response?.items || []).filter((item) => item?.name !== 'd/');
        this.isLoading = false;
        this.loadNameAliveStatuses(this.names);
        this.cd.markForCheck();
      });
  }

  submitSearch(rawQuery: string): void {
    const query = (rawQuery || '').trim();

    if (!query) {
      return;
    }

    this.router.navigate([this.relativeUrlPipe.transform('/names')], {
      queryParams: { q: query },
    });
  }

  clearSearch(): void {
    this.router.navigate([this.relativeUrlPipe.transform('/names')], {
      queryParams: {},
    });
  }

  private loadNameAliveStatuses(items: NameRecord[]): void {
    const requestId = ++this.aliveCheckRequestId;
    const supportedNames = (items || []).filter((item) => item?.name?.startsWith('d/'));

    this.nameAliveStatus = {};
    for (const item of supportedNames) {
      this.nameAliveStatus[item.name] = undefined;
    }
    this.cd.markForCheck();

    from(supportedNames)
      .pipe(
        mergeMap((item) =>
          from(this.checkNameAliveClient(item)).pipe(
            tap((status) => {
              if (requestId !== this.aliveCheckRequestId) {
                return;
              }
              this.nameAliveStatus[item.name] = status;
              this.cd.markForCheck();
            }),
            catchError((error) => of({
              name: item.name,
              displayName: item.displayName || item.name,
              url: null,
              alive: false,
              checkedAt: Math.floor(Date.now() / 1000),
              statusCode: null,
              error: this.formatProbeError(error),
            } as NameAliveStatus)),
          ),
          4,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private async checkNameAliveClient(item: NameRecord): Promise<NameAliveStatus> {
    const checkedAt = Math.floor(Date.now() / 1000);
    const displayDomain = this.getDisplayDomain(item);

    if (!displayDomain) {
      return {
        name: item.name,
        displayName: item.displayName || item.name,
        url: null,
        alive: false,
        checkedAt,
        statusCode: null,
        error: 'Invalid Namecoin domain format.',
      };
    }

    const protocolCandidates = this.getProtocolCandidates();
    let lastError = 'No response from domain.';
    let lastUrl: string | null = null;

    for (const protocol of protocolCandidates) {
      const url = `${protocol}://${displayDomain}`;
      lastUrl = url;
      const result = await this.probeUrl(url);
      if (result.alive) {
        return {
          name: item.name,
          displayName: displayDomain,
          url,
          alive: true,
          checkedAt,
          statusCode: null,
          error: null,
        };
      }
      if (result.error) {
        lastError = result.error;
      }
    }

    return {
      name: item.name,
      displayName: displayDomain,
      url: lastUrl,
      alive: false,
      checkedAt,
      statusCode: null,
      error: lastError,
    };
  }

  private async probeUrl(url: string): Promise<{ alive: boolean; error?: string }> {
    if (typeof fetch !== 'function') {
      return {
        alive: false,
        error: 'Browser does not support client-side domain probing.',
      };
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), this.aliveProbeTimeoutMs);

    try {
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'follow',
        credentials: 'omit',
        signal: controller?.signal,
      });
      return { alive: true };
    } catch (error) {
      return {
        alive: false,
        error: this.formatProbeError(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private getDisplayDomain(item: NameRecord): string | null {
    const display = (item.displayName || '').trim().toLowerCase();
    if (display === '.bit') {
      return '.bit';
    }
    if (display.endsWith('.bit')) {
      const label = display.slice(0, -4);
      if (this.domainLabelRegex.test(label)) {
        return `${label}.bit`;
      }
    }

    if (!item?.name?.startsWith('d/')) {
      return null;
    }

    const label = item.name.slice(2).trim().toLowerCase();
    if (label.length === 0) {
      return '.bit';
    }
    if (!this.domainLabelRegex.test(label)) {
      return null;
    }
    return `${label}.bit`;
  }

  private getProtocolCandidates(): string[] {
    return ['http'];
  }

  private formatProbeError(error: unknown): string {
    if (error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError') {
      return `Timed out after ${this.aliveProbeTimeoutMs}ms.`;
    }

    if (error instanceof Error) {
      if (error.message?.includes('Failed to fetch')) {
        return 'Network/DNS/TLS failure, blocked mixed content, or CORS-restricted response.';
      }
      return error.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown client probe error.';
    }
  }

  getNameAliveState(name: NameRecord): 'checking' | 'alive' | 'offline' | 'na' {
    if (!name?.name?.startsWith('d/')) {
      return 'na';
    }

    const status = this.nameAliveStatus[name.name];
    if (status === undefined) {
      return 'checking';
    }
    return status?.alive ? 'alive' : 'offline';
  }

  getNameAliveTooltip(name: NameRecord): string {
    const status = this.nameAliveStatus[name.name];
    if (!status) {
      return '';
    }
    if (status.alive && status.url) {
      const code = status.statusCode ? ` (HTTP ${status.statusCode})` : '';
      return `Alive via ${status.url}${code}`;
    }
    return status.error || 'No response';
  }

  private extractErrorDetails(error: HttpErrorResponse): string {
    if (!error) {
      return 'No error details were provided.';
    }

    const body = error.error;
    if (typeof body === 'string' && body.trim().length > 0) {
      return body;
    }

    if (body && typeof body === 'object') {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
      try {
        return JSON.stringify(body);
      } catch {
        return 'Server returned a non-serializable error payload.';
      }
    }

    if (error.message) {
      return error.message;
    }

    return 'No error details were provided.';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

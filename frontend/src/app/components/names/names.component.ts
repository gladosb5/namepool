import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '@app/services/api.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { SeoService } from '@app/services/seo.service';
import { NameRecord } from '@interfaces/node-api.interface';
import { Subject, of } from 'rxjs';
import { catchError, distinctUntilChanged, map, switchMap, takeUntil, tap } from 'rxjs/operators';
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

  names: NameRecord[] = [];
  query = '';
  currentQuery = '';
  isLoading = true;
  error: string | null = null;

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
    this.seoService.setTitle($localize`:@@names.page-title:Namecoin Domains`);
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
          this.cd.markForCheck();
        }),
        switchMap((query) => this.apiService.listNames$({
          query: query || undefined,
          prefix: query ? undefined : 'd/',
          count: this.maxRows,
        }).pipe(
          map((response) => response.items || []),
          catchError(() => {
            this.error = query
              ? $localize`:@@names.search-error:Failed to load names for this search.`
              : $localize`:@@names.list-error:Failed to load names list.`;
            return of([] as NameRecord[]);
          })
        )),
        takeUntil(this.destroy$),
      )
      .subscribe((items) => {
        this.names = items;
        this.isLoading = false;
        this.cd.markForCheck();
      });
  }

  submitSearch(rawQuery: string): void {
    const query = (rawQuery || '').trim();
    this.router.navigate([this.relativeUrlPipe.transform('/names')], {
      queryParams: query ? { q: query } : {},
    });
  }

  clearSearch(): void {
    this.submitSearch('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

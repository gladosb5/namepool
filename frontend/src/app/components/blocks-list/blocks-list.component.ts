import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef, Inject, LOCALE_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, Observable, timer, of, Subscription } from 'rxjs';
import { debounceTime, delayWhen, filter, map, retryWhen, scan, skip, switchMap, tap, throttleTime } from 'rxjs/operators';
import { BlockExtended } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

type BlocksSort =
  | 'height_desc'
  | 'height_asc'
  | 'timestamp_desc'
  | 'timestamp_asc'
  | 'size_desc'
  | 'size_asc'
  | 'tx_desc'
  | 'tx_asc'
  | 'fees_desc'
  | 'fees_asc';

@Component({
  selector: 'app-blocks-list',
  templateUrl: './blocks-list.component.html',
  styleUrls: ['./blocks-list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocksList implements OnInit {
  @Input() widget: boolean = false;

  blocks$: Observable<BlockExtended[]> = undefined;

  readonly defaultSort: BlocksSort = 'height_desc';
  sort: BlocksSort = this.defaultSort;
  minSizeBytes: number | null = null;
  minTxCount: number | null = null;

  isMempoolModule = false;
  indexingAvailable = false;
  auditAvailable = false;
  isLoading = true;
  fromBlockHeight = undefined;
  lastBlockHeightFetched = -1;
  paginationMaxSize: number;
  page = 1;
  lastPage = 1;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  blocksCount: number;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromBlockHeight);
  skeletonLines: number[] = [];
  lastBlockHeight = -1;
  blocksCountInitialized$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  blocksCountInitializedSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  filtersSubscription: Subscription;
  dir: 'rtl' | 'ltr' = 'ltr';

  private sortSubject: BehaviorSubject<BlocksSort> = new BehaviorSubject<BlocksSort>(this.defaultSort);
  private minSizeSubject: BehaviorSubject<number | null> = new BehaviorSubject<number | null>(null);
  private minTxSubject: BehaviorSubject<number | null> = new BehaviorSubject<number | null>(null);

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    this.isMempoolModule = this.stateService.env.BASE_MODULE === 'mempool';
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.indexingAvailable = (this.stateService.env.BASE_MODULE === 'mempool' &&
      this.stateService.env.MINING_DASHBOARD === true);
    this.auditAvailable = this.indexingAvailable && this.stateService.env.AUDIT;

    if (!this.widget) {
      this.websocketService.want(['blocks']);
      
      this.seoService.setTitle($localize`:@@8a7b4bd44c0ac71b2e72de0398b303257f7d2f54:Blocks`);
      this.ogService.setManualOgImage('recent-blocks.jpg');
      if( this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet' ) {
        this.seoService.setDescription($localize`:@@meta.description.liquid.blocks:See the most recent Liquid${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block size, and more.`);
      } else {
        this.seoService.setDescription($localize`:@@meta.description.namecoin.blocks:See the most recent Namecoin${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block reward, block size, and more.`);
      }

      this.blocksCountInitializedSubscription = combineLatest([this.blocksCountInitialized$, this.route.params]).pipe(
        filter(([blocksCountInitialized, _]) => blocksCountInitialized),
        tap(([_, params]) => {
          this.page = +params['page'] || 1;
          this.page === 1 ? this.fromHeightSubject.next(undefined) : this.fromHeightSubject.next((this.blocksCount - 1) - (this.page - 1) * 15);
        })
      ).subscribe();

      const prevKey = this.dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';

      this.keyNavigationSubscription = this.stateService.keyNavigation$
      .pipe(
        filter((event) => event.key === prevKey || event.key === nextKey),
        tap((event) => {
          if (event.key === prevKey && this.page > 1) {
            this.page--;
            this.isLoading = true;
            this.cd.markForCheck();
          }
          if (event.key === nextKey && this.page * 15 < this.blocksCount) {
            this.page++;
            this.isLoading = true;
            this.cd.markForCheck();
          }
        }),
        throttleTime(1000, undefined, { leading: true, trailing: true }),
      ).subscribe(() => {
        this.pageChange(this.page);
      });
    }

    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
    
    const baseBlocks$ = combineLatest([
      this.fromHeightSubject.pipe(
        filter(fromBlockHeight => fromBlockHeight !== this.lastBlockHeightFetched),
        switchMap((fromBlockHeight) => {
          this.isLoading = true;
          this.lastBlockHeightFetched = fromBlockHeight;
          return this.apiService.getBlocks$(this.page === 1 ? undefined : fromBlockHeight)
            .pipe(
              tap(blocks => {
                if (this.blocksCount === undefined) {
                  this.blocksCount = blocks[0].height + 1;
                  this.blocksCountInitialized$.next(true);
                  this.blocksCountInitialized$.complete();
                }
                this.isLoading = false;
                this.lastBlockHeight = Math.max(...blocks.map(o => o.height));
              }),
              map(blocks => {
                if (this.stateService.env.BASE_MODULE === 'mempool') {
                  for (const block of blocks) {
                    // @ts-ignore: Need to add an extra field for the template
                    block.extras.pool.logo = `/resources/mining-pools/` + block.extras.pool.slug + '.svg';
                  }
                }
                if (this.widget) {
                  return blocks.slice(0, 6);
                }
                return blocks;
              }),
              retryWhen(errors => errors.pipe(delayWhen(() => timer(10000))))
            );
        })
      ),
      this.stateService.blocks$
        .pipe(
          switchMap((blocks) => {
            if (blocks[0].height <= this.lastBlockHeight) {
              return of([]); // Return an empty stream so the last pipe is not executed
            }
            this.lastBlockHeight = blocks[0].height;
            return of(blocks);
          })
        )
    ])
      .pipe(
        scan((acc, blocks) => {
          if (this.page > 1 || acc.length === 0 || (this.page === 1 && this.lastPage !== 1)) {
            this.lastPage = this.page;
            return blocks[0];
          }
          if (blocks[1] && blocks[1].length) {
            this.blocksCount = Math.max(this.blocksCount, blocks[1][0].height) + 1;
            if (this.isMempoolModule) {
              // @ts-ignore: Need to add an extra field for the template
              blocks[1][0].extras.pool.logo = `/resources/mining-pools/` +
                blocks[1][0].extras.pool.slug + '.svg';
            }
            acc.unshift(blocks[1][0]);
            acc = acc.slice(0, this.widget ? 6 : 15);
          }
          return acc;
        }, []),
        switchMap((blocks) => {
          if (this.isMempoolModule && this.auditAvailable) {
            blocks.forEach(block => {
              block.extras.feeDelta = block.extras.expectedFees ? (block.extras.totalFees - block.extras.expectedFees) / block.extras.expectedFees : 0;
            });
          }
          return of(blocks);
        })
      );

    if (!this.widget) {
      this.filtersSubscription = this.route.queryParams
        .pipe(
          tap((queryParams) => {
            const nextSort = this.normalizeSort(queryParams['sort']);
            const nextMinSize = this.parseOptionalNonNegativeInt(queryParams['minSize']);
            const nextMinTx = this.parseOptionalNonNegativeInt(queryParams['minTx']);

            this.sort = nextSort;
            this.minSizeBytes = nextMinSize;
            this.minTxCount = nextMinTx;

            this.sortSubject.next(nextSort);
            this.minSizeSubject.next(nextMinSize);
            this.minTxSubject.next(nextMinTx);
            this.cd.markForCheck();
          })
        )
        .subscribe();
    }

    this.blocks$ = combineLatest([
      baseBlocks$,
      combineLatest([this.sortSubject, this.minSizeSubject, this.minTxSubject]),
    ]).pipe(
      map(([blocks, [sort, minSizeBytes, minTxCount]]) =>
        this.applySortAndFilters(blocks, sort, minSizeBytes, minTxCount)
      )
    );
  }

  pageChange(page: number): void {
    this.router.navigate([this.relativeUrlPipe.transform('/blocks/'), page], { queryParamsHandling: 'preserve' });
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }

  isEllipsisActive(e): boolean {
    return (e.offsetWidth < e.scrollWidth);
  }

  onSortChange(sort: string): void {
    const nextSort = this.normalizeSort(sort);
    this.sortSubject.next(nextSort);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: nextSort },
      queryParamsHandling: 'merge',
    });
  }

  onMinSizeChange(minSizeBytes: string): void {
    const nextMinSize = this.parseOptionalNonNegativeInt(minSizeBytes);
    this.minSizeSubject.next(nextMinSize);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { minSize: nextMinSize },
      queryParamsHandling: 'merge',
    });
  }

  onMinTxChange(minTxCount: string): void {
    const nextMinTx = this.parseOptionalNonNegativeInt(minTxCount);
    this.minTxSubject.next(nextMinTx);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { minTx: nextMinTx },
      queryParamsHandling: 'merge',
    });
  }

  resetFilters(): void {
    this.sortSubject.next(this.defaultSort);
    this.minSizeSubject.next(null);
    this.minTxSubject.next(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: this.defaultSort, minSize: null, minTx: null },
      queryParamsHandling: 'merge',
    });
  }

  private applySortAndFilters(
    blocks: BlockExtended[],
    sort: BlocksSort,
    minSizeBytes: number | null,
    minTxCount: number | null,
  ): BlockExtended[] {
    let result = blocks;
    if (minSizeBytes !== null) {
      result = result.filter((b) => (b.size ?? 0) >= minSizeBytes);
    }
    if (minTxCount !== null) {
      result = result.filter((b) => (b.tx_count ?? 0) >= minTxCount);
    }

    const byHeightDesc = (a: BlockExtended, b: BlockExtended) => (b.height ?? 0) - (a.height ?? 0);
    const sorted = [...result];

    sorted.sort((a, b) => {
      const aFees = a.extras?.totalFees ?? 0;
      const bFees = b.extras?.totalFees ?? 0;
      const cmp = (() => {
        switch (sort) {
          case 'height_desc': return (b.height ?? 0) - (a.height ?? 0);
          case 'height_asc': return (a.height ?? 0) - (b.height ?? 0);
          case 'timestamp_desc': return (b.timestamp ?? 0) - (a.timestamp ?? 0);
          case 'timestamp_asc': return (a.timestamp ?? 0) - (b.timestamp ?? 0);
          case 'size_desc': return (b.size ?? 0) - (a.size ?? 0);
          case 'size_asc': return (a.size ?? 0) - (b.size ?? 0);
          case 'tx_desc': return (b.tx_count ?? 0) - (a.tx_count ?? 0);
          case 'tx_asc': return (a.tx_count ?? 0) - (b.tx_count ?? 0);
          case 'fees_desc': return bFees - aFees;
          case 'fees_asc': return aFees - bFees;
          default: return 0;
        }
      })();

      if (cmp !== 0) {
        return cmp;
      }
      return byHeightDesc(a, b);
    });

    return sorted;
  }

  private normalizeSort(sort: unknown): BlocksSort {
    const allowedSorts: BlocksSort[] = [
      'height_desc',
      'height_asc',
      'timestamp_desc',
      'timestamp_asc',
      'size_desc',
      'size_asc',
      'tx_desc',
      'tx_asc',
      'fees_desc',
      'fees_asc',
    ];
    const value = typeof sort === 'string' ? sort : '';
    if (!allowedSorts.includes(value as BlocksSort)) {
      return this.defaultSort;
    }
    if (!this.isMempoolModule && (value === 'fees_desc' || value === 'fees_asc')) {
      return this.defaultSort;
    }
    return value as BlocksSort;
  }

  private parseOptionalNonNegativeInt(value: unknown): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  ngOnDestroy(): void {
    this.blocksCountInitializedSubscription?.unsubscribe();
    this.keyNavigationSubscription?.unsubscribe();
    this.filtersSubscription?.unsubscribe();
  }
}

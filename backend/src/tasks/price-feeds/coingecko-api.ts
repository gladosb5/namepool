import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class CoingeckoApi implements PriceFeed {
  public name: string = 'CoinGecko';
  public currencies: string[] = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY'];

  public url: string = 'https://api.coingecko.com/api/v3/simple/price?ids=namecoin&vs_currencies={CURRENCY}';
  public urlHist: string = 'https://api.coingecko.com/api/v3/coins/namecoin/market_chart?vs_currency={CURRENCY}&days={DAYS}';

  private roundFiat(price: number): number {
    // Keep enough precision for low-priced assets while staying stable across feeds.
    return Math.round(price * 1_000_000) / 1_000_000;
  }

  public async $fetchPrice(currency: string): Promise<number> {
    const response: any = await query(
      this.url.replace('{CURRENCY}', currency.toLowerCase())
    );

    const value = response?.namecoin?.[currency.toLowerCase()];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return -1;
    }
    return this.roundFiat(value);
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};
    const days = type === 'hour' ? '30' : 'max';

    for (const currency of currencies) {
      if (this.currencies.includes(currency) === false) {
        continue;
      }

      const response: any = await query(
        this.urlHist
          .replace('{CURRENCY}', currency.toLowerCase())
          .replace('{DAYS}', days)
      );

      const pricesRaw: any[] = response?.prices || [];
      for (const price of pricesRaw) {
        const timestamp = Math.floor(price[0] / 1000);
        const value = price[1];
        if (priceHistory[timestamp] === undefined) {
          priceHistory[timestamp] = priceUpdater.getEmptyPricesObj();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          priceHistory[timestamp][currency] = this.roundFiat(value);
        }
      }
    }

    return priceHistory;
  }
}

export default CoingeckoApi;


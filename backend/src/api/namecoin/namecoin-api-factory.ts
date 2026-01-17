import config from '../../config';
import { AbstractNamecoinApi } from './namecoin-api-abstract-factory';
import EsploraApi from './esplora-api';
import NamecoinApi from './namecoin-api';
import ElectrumApi from './electrum-api';
import namecoinClient from './namecoin-client';

function namecoinApiFactory(): AbstractNamecoinApi {
  switch (config.MEMPOOL.BACKEND) {
    case 'esplora':
      return new EsploraApi();
    case 'electrum':
      return new ElectrumApi(namecoinClient);
    case 'none':
    default:
      return new NamecoinApi(namecoinClient);
  }
}

export const namecoinCoreApi = new NamecoinApi(namecoinClient);

export default namecoinApiFactory();

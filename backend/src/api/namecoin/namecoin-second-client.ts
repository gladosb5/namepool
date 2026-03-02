import config from '../../config';
const namecoin = require('../../rpc-api/index');
import { NamecoinRpcCredentials } from './namecoin-api-abstract-factory';

const nodeRpcCredentials: NamecoinRpcCredentials = {
  host: config.SECOND_CORE_RPC.HOST,
  port: config.SECOND_CORE_RPC.PORT,
  user: config.SECOND_CORE_RPC.USERNAME,
  pass: config.SECOND_CORE_RPC.PASSWORD,
  timeout: config.SECOND_CORE_RPC.TIMEOUT,
  cookie: config.SECOND_CORE_RPC.COOKIE ? config.SECOND_CORE_RPC.COOKIE_PATH : undefined,
};

export default new namecoin.Client(nodeRpcCredentials);

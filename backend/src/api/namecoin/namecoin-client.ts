import config from '../../config';
const namecoin = require('../../rpc-api/index');
import { NamecoinRpcCredentials } from './namecoin-api-abstract-factory';

const nodeRpcCredentials: NamecoinRpcCredentials = {
  host: config.CORE_RPC.HOST,
  port: config.CORE_RPC.PORT,
  user: config.CORE_RPC.USERNAME,
  pass: config.CORE_RPC.PASSWORD,
  timeout: config.CORE_RPC.TIMEOUT,
  cookie: config.CORE_RPC.COOKIE ? config.CORE_RPC.COOKIE_PATH : undefined,
};

export default new namecoin.Client(nodeRpcCredentials);

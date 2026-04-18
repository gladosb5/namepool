import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import config from '../../config';
import { getRecentFirstSeen } from '../../utils/file-read';

describe('getRecentFirstSeen', () => {
  let tempDir: string;
  let originalDebugLogPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'namepool-file-read-'));
    originalDebugLogPath = config.CORE_RPC.DEBUG_LOG_PATH;
  });

  afterEach(() => {
    config.CORE_RPC.DEBUG_LOG_PATH = originalDebugLogPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads small debug.log files without throwing and returns a header match', () => {
    const hash = 'abcd1234';
    const logPath = path.join(tempDir, 'debug.log');
    fs.writeFileSync(logPath, `2026-04-18T10:20:30.123456Z Saw new header hash=${hash}\n`);

    config.CORE_RPC.DEBUG_LOG_PATH = logPath;

    expect(getRecentFirstSeen(hash)).toBe(1776507630.123456);
  });

  it('falls back to the most recent UpdateTip match when no header line exists', () => {
    const hash = 'efgh5678';
    const logPath = path.join(tempDir, 'debug.log');
    fs.writeFileSync(logPath, `2026-04-18T10:20:31Z UpdateTip: new best=${hash}\n`);

    config.CORE_RPC.DEBUG_LOG_PATH = logPath;

    expect(getRecentFirstSeen(hash)).toBe(1776507631);
  });
});

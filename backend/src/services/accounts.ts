import { EventEmitter } from 'events';
import { watch, type FSWatcher } from 'chokidar';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import type { RawAccountsFile, RawAccountData } from '../types.js';

const ACCOUNTS_FILE_PATH = join(homedir(), '.config', 'opencode', 'antigravity-accounts.json');

export interface SimpleAccount {
  email: string;
  projectId?: string;
  isActive: boolean;
  refreshToken: string;
  rateLimitResetTimes?: Record<string, number>;
}

export class AccountsFileService extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private accounts: SimpleAccount[] = [];
  private rawData: RawAccountsFile | null = null;

  constructor() {
    super();
    this.loadFile();
    this.setupWatcher();
  }

  private setupWatcher(): void {
    if (!existsSync(ACCOUNTS_FILE_PATH)) {
      console.warn(`[Accounts] File not found: ${ACCOUNTS_FILE_PATH}`);
      return;
    }

    this.watcher = watch(ACCOUNTS_FILE_PATH, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    this.watcher.on('change', () => {
      console.log('[Accounts] File changed, reloading...');
      this.loadFile();
      this.emit('accounts_changed', this.accounts);
    });

    this.watcher.on('error', (error) => {
      console.error('[Accounts] Watcher error:', error);
    });
  }

  private loadFile(): void {
    try {
      if (!existsSync(ACCOUNTS_FILE_PATH)) {
        this.accounts = [];
        this.rawData = null;
        return;
      }

      const content = readFileSync(ACCOUNTS_FILE_PATH, 'utf-8');
      const data: RawAccountsFile = JSON.parse(content);
      this.rawData = data;

      this.accounts = data.accounts.map((raw, index) => ({
        email: raw.email,
        projectId: raw.projectId,
        isActive: index === data.activeIndex,
        refreshToken: raw.refreshToken,
        rateLimitResetTimes: raw.rateLimitResetTimes,
      }));

      console.log(`[Accounts] Loaded ${this.accounts.length} accounts`);
    } catch (error) {
      console.error('[Accounts] Error loading file:', error);
    }
  }

  getAccounts(): SimpleAccount[] {
    return this.accounts;
  }

  getRawAccounts(): Array<{ email: string; refreshToken: string; projectId?: string }> {
    return this.accounts.map(a => ({
      email: a.email,
      refreshToken: a.refreshToken,
      projectId: a.projectId,
    }));
  }

  getActiveAccount(): SimpleAccount | null {
    return this.accounts.find(a => a.isActive) || null;
  }

  async setActiveAccount(email: string): Promise<void> {
    if (!this.rawData) {
      throw new Error('No accounts loaded');
    }

    const index = this.rawData.accounts.findIndex(
      a => a.email.toLowerCase() === email.toLowerCase()
    );

    if (index === -1) {
      throw new Error(`Account ${email} not found`);
    }

    const data = { ...this.rawData };
    data.activeIndex = index;

    // Also update per-family indices
    if (!data.activeIndexByFamily) {
      data.activeIndexByFamily = {};
    }
    data.activeIndexByFamily.claude = index;
    data.activeIndexByFamily.gemini = index;

    // Update lastUsed
    data.accounts[index] = {
      ...data.accounts[index],
      lastUsed: Date.now(),
    };

    await this.saveFile(data);
    this.loadFile();
  }

  private async saveFile(data: RawAccountsFile): Promise<void> {
    const dir = dirname(ACCOUNTS_FILE_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(ACCOUNTS_FILE_PATH, JSON.stringify(data, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
    console.log('[Accounts] Saved accounts file');
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

let instance: AccountsFileService | null = null;

export function getAccountsService(): AccountsFileService {
  if (!instance) {
    instance = new AccountsFileService();
  }
  return instance;
}

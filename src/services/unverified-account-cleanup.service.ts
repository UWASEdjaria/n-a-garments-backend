import { prisma } from '../utils/prisma.js';

const ACCOUNT_RETENTION_MS = 72 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let cleanupInterval: ReturnType<typeof setInterval> | undefined;

async function cleanupExpiredUnverifiedAccounts(): Promise<void> {
  try {
    const cutoffDate = new Date(Date.now() - ACCOUNT_RETENTION_MS);

    const result = await prisma.user.deleteMany({
      where: {
        role: 'CUSTOMER',
        isEmailVerified: false,
        createdAt: {
          lte: cutoffDate,
        },
        orders: {
          none: {},
        },
        customOrders: {
          none: {},
        },
      },
    });

    if (result.count > 0) {
      console.info(
        `[Account Cleanup] Deleted ${result.count} expired unverified account(s).`
      );
    }
  } catch (error) {
    console.error('[Account Cleanup] Failed to clean expired accounts:', error);
  }
}

export function startUnverifiedAccountCleanup(): void {
  if (cleanupInterval) {
    return;
  }

  console.info('[Account Cleanup] Automatic cleanup started.');

  void cleanupExpiredUnverifiedAccounts();

  cleanupInterval = setInterval(() => {
    void cleanupExpiredUnverifiedAccounts();
  }, CLEANUP_INTERVAL_MS);
}
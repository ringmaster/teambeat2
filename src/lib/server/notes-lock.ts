interface NotesLock {
	userId: string;
	userName: string;
	timestamp: number;
	timeoutId: NodeJS.Timeout;
}

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const notesLocks = new Map<string, NotesLock>();

export function acquireNotesLock(
	cardId: string,
	userId: string,
	userName: string,
): { success: boolean; lockedBy?: string; expiresAt?: number } {
	const existing = notesLocks.get(cardId);

	// Check if already locked by different user
	if (existing && existing.userId !== userId && !isLockExpired(existing)) {
		return {
			success: false,
			lockedBy: existing.userName,
			expiresAt: existing.timestamp + LOCK_TIMEOUT,
		};
	}

	// Clear any existing timeout
	if (existing?.timeoutId) {
		clearTimeout(existing.timeoutId);
	}

	// Set new lock with auto-release
	const timeoutId = setTimeout(() => {
		notesLocks.delete(cardId);
		// Could broadcast lock release here if needed
	}, LOCK_TIMEOUT);

	notesLocks.set(cardId, {
		userId,
		userName,
		timestamp: Date.now(),
		timeoutId,
	});

	return { success: true };
}

export function releaseNotesLock(cardId: string, userId: string): boolean {
	const lock = notesLocks.get(cardId);
	if (lock && lock.userId === userId) {
		clearTimeout(lock.timeoutId);
		notesLocks.delete(cardId);
		return true;
	}
	return false;
}

export function getNotesLock(cardId: string): NotesLock | undefined {
	const lock = notesLocks.get(cardId);
	if (lock && !isLockExpired(lock)) {
		return lock;
	}
	// Clean up expired lock
	if (lock) {
		clearTimeout(lock.timeoutId);
		notesLocks.delete(cardId);
	}
	return undefined;
}

function isLockExpired(lock: NotesLock): boolean {
	return Date.now() - lock.timestamp > LOCK_TIMEOUT;
}

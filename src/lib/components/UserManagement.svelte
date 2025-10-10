<script lang="ts">
    import Icon from "./ui/Icon.svelte";

    interface User {
        userId: string;
        userName: string;
        email: string;
        role: "admin" | "facilitator" | "member";
        joinedAt: string;
    }

    interface Props {
        seriesId: string;
        currentUserRole: string;
        users: User[];
        onUserAdded: (email: string) => void;
        onUserRemoved: (userId: string) => void;
        onUserRoleChanged: (
            userId: string,
            newRole: "admin" | "facilitator" | "member",
        ) => void;
    }

    let {
        seriesId: _seriesId,
        currentUserRole,
        users = $bindable(),
        onUserAdded,
        onUserRemoved,
        onUserRoleChanged,
    }: Props = $props();

    let newUserEmail = $state("");
    let addingUser = $state(false);
    let addUserError = $state("");

    async function handleAddUser() {
        if (!newUserEmail.trim()) {
            addUserError = "Email is required";
            return;
        }

        if (!isValidEmail(newUserEmail)) {
            addUserError = "Please enter a valid email address";
            return;
        }

        addingUser = true;
        addUserError = "";

        try {
            await onUserAdded(newUserEmail.trim());
            newUserEmail = "";
        } catch (error) {
            addUserError = "Failed to add user";
        } finally {
            addingUser = false;
        }
    }

    function isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function canModifyUser(targetUserRole: string): boolean {
        // Only admins can modify other users
        if (currentUserRole !== "admin") return false;

        // Admins can modify facilitators and members, but not other admins
        return targetUserRole !== "admin";
    }

    function canRemoveUser(targetUserRole: string): boolean {
        // Only admins can remove users
        if (currentUserRole !== "admin") return false;

        // Admins can remove facilitators and members, but not other admins
        return targetUserRole !== "admin";
    }

    function getRoleBadgeClass(role: string): string {
        switch (role) {
            case "admin":
                return "badge-error";
            case "facilitator":
                return "badge-warning";
            case "member":
                return "badge-neutral";
            default:
                return "badge-ghost";
        }
    }
</script>

<div class="user-management">
    <!-- Add User Section -->
    {#if currentUserRole === "admin"}
        <div class="add-user-section">
            <h4 class="section-header">Add Existing User To This Series</h4>
            <div class="add-user-form">
                <input
                    type="email"
                    bind:value={newUserEmail}
                    placeholder="Enter existing user's email..."
                    class="email-input"
                    disabled={addingUser}
                    onkeydown={(e) => {
                        if (e.key === "Enter") handleAddUser();
                    }}
                />
                <button
                    onclick={handleAddUser}
                    disabled={addingUser || !newUserEmail.trim()}
                    class="btn-primary add-user-button"
                >
                    {#if addingUser}
                        <div class="loading-spinner-small"></div>
                        Adding...
                    {:else}
                        <Icon name="plus" size="md" class="icon-white" />
                        Add User
                    {/if}
                </button>
            </div>
            {#if addUserError}
                <div class="form-error-small">{addUserError}</div>
            {/if}
        </div>
    {/if}

    <!-- Users List -->
    <div class="users-list-section">
        <h4 class="section-header">Current Users ({users.length})</h4>

        {#if users.length === 0}
            <div class="empty-users-state">
                <div class="empty-users-text">No users in this series yet</div>
            </div>
        {:else}
            <div class="users-list">
                {#each users as user (user.userId)}
                    <div class="user-card">
                        <div class="user-info">
                            <div class="user-name-role">
                                <div class="user-name">
                                    {user.userName || "Unknown User"}
                                </div>
                                <div
                                    class="role-badge role-{user.role} {getRoleBadgeClass(
                                        user.role,
                                    )}"
                                >
                                    {user.role}
                                </div>
                            </div>
                            <div class="user-details">
                                {user.email} • Joined {new Date(
                                    user.joinedAt,
                                ).toLocaleDateString()}
                            </div>
                        </div>

                        <div class="user-actions">
                            {#if canModifyUser(user.role)}
                                <select
                                    value={user.role}
                                    onchange={(e) =>
                                        onUserRoleChanged(
                                            user.userId,
                                            e.target.value,
                                        )}
                                    class="role-select"
                                >
                                    <option value="member">Member</option>
                                    <option value="facilitator"
                                        >Facilitator</option
                                    >
                                    <option value="admin">Admin</option>
                                </select>
                            {/if}

                            {#if canRemoveUser(user.role)}
                                <button
                                    onclick={() => onUserRemoved(user.userId)}
                                    class="remove-user-button"
                                    title="Remove user"
                                    aria-label="Remove user"
                                >
                                    <svg
                                        class="icon-sm"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Help Text -->
    <div class="permissions-help">
        <div class="help-title">Role Permissions:</div>
        <ul class="permissions-list">
            <li>
                <strong>Admin:</strong> Full access - can manage users, boards, and
                series settings
            </li>
            <li>
                <strong>Facilitator:</strong> Can create/manage boards and see draft
                boards
            </li>
            <li>
                <strong>Member:</strong> Can participate in active and completed
                boards
            </li>
        </ul>
    </div>
</div>

<style>
    .user-management {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-6);
    }

    .management-title {
        font-size: 1.125rem;
        line-height: 1.75rem;
        font-weight: 500;
        color: var(--color-text-primary);
        margin: 0;
    }

    .add-user-section {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--spacing-4);
        background-color: var(--surface-elevated);
    }

    .section-header {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        margin: 0 0 var(--spacing-3) 0;
    }

    .add-user-form {
        display: flex;
        gap: var(--spacing-2);
    }

    .email-input {
        flex: 1;
        padding: var(--spacing-2) var(--spacing-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        background-color: white;
    }

    .email-input:focus {
        outline: none;
        border-color: var(--color-primary);
        ring: 2px solid
            color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    .email-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .add-user-button {
        white-space: nowrap;
        font-size: 0.875rem;
        padding: var(--spacing-2) var(--spacing-3);
    }

    .loading-spinner-small {
        width: 1rem;
        height: 1rem;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: var(--spacing-2);
    }

    .form-error-small {
        color: var(--color-danger);
        font-size: 0.75rem;
        line-height: 1rem;
        margin-top: var(--spacing-2);
    }

    .users-list-section {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
    }

    .empty-users-state {
        text-align: center;
        padding: var(--spacing-8) 0;
        color: var(--color-text-muted);
    }

    .empty-users-text {
        font-size: 0.875rem;
    }

    .users-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .user-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .user-info {
        flex: 1;
        min-width: 0;
    }

    .user-name-role {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
    }

    .user-name {
        font-weight: 500;
        font-size: 0.875rem;
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .role-badge {
        font-size: 0.75rem;
        padding: 0.125rem var(--spacing-2);
        border-radius: var(--radius-full);
        font-weight: 500;
        line-height: 1rem;
    }

    .role-badge.role-admin {
        background-color: var(--status-error-bg);
        color: var(--status-error-text);
    }

    .role-badge.role-facilitator {
        background-color: var(--status-warning-bg);
        color: var(--status-warning-text);
    }

    .role-badge.role-member {
        background-color: var(--surface-primary);
        color: var(--color-text-primary);
    }

    .user-details {
        font-size: 0.75rem;
        line-height: 1rem;
        color: var(--color-text-muted);
        margin-top: 0.125rem;
    }

    .user-actions {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        margin-left: var(--spacing-4);
    }

    .role-select {
        padding: 0.125rem var(--spacing-2);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 0.75rem;
        line-height: 1rem;
        background-color: white;
        cursor: pointer;
    }

    .remove-user-button {
        padding: 0.125rem;
        background: none;
        border: none;
        color: var(--color-danger);
        cursor: pointer;
        border-radius: var(--radius-md);
        transition: all var(--transition-fast);
    }

    .remove-user-button:hover {
        background-color: var(--status-error-bg);
        color: var(--color-danger-hover);
    }

    .permissions-help {
        font-size: 0.75rem;
        line-height: 1rem;
        color: var(--color-text-muted);
        background-color: var(--status-info-bg);
        padding: var(--spacing-3);
        border-radius: var(--radius-lg);
    }

    .help-title {
        font-weight: 500;
        margin-bottom: 0.25rem;
    }

    .permissions-list {
        margin-left: var(--spacing-2);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>

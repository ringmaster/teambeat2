<script lang="ts">
    interface User {
        userId: string;
        userName: string;
        email: string;
        role: 'admin' | 'facilitator' | 'member';
        joinedAt: string;
    }

    interface Props {
        seriesId: string;
        currentUserRole: string;
        users: User[];
        onUserAdded: (email: string) => void;
        onUserRemoved: (userId: string) => void;
        onUserRoleChanged: (userId: string, newRole: 'admin' | 'facilitator' | 'member') => void;
    }

    let {
        seriesId,
        currentUserRole,
        users = $bindable(),
        onUserAdded,
        onUserRemoved,
        onUserRoleChanged
    }: Props = $props();

    let newUserEmail = $state('');
    let addingUser = $state(false);
    let addUserError = $state('');

    async function handleAddUser() {
        if (!newUserEmail.trim()) {
            addUserError = 'Email is required';
            return;
        }

        if (!isValidEmail(newUserEmail)) {
            addUserError = 'Please enter a valid email address';
            return;
        }

        addingUser = true;
        addUserError = '';

        try {
            await onUserAdded(newUserEmail.trim());
            newUserEmail = '';
        } catch (error) {
            addUserError = 'Failed to add user';
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
        if (currentUserRole !== 'admin') return false;
        
        // Admins can modify facilitators and members, but not other admins
        return targetUserRole !== 'admin';
    }

    function canRemoveUser(targetUserRole: string): boolean {
        // Only admins can remove users
        if (currentUserRole !== 'admin') return false;
        
        // Admins can remove facilitators and members, but not other admins
        return targetUserRole !== 'admin';
    }

    function getRoleBadgeClass(role: string): string {
        switch (role) {
            case 'admin':
                return 'badge-error';
            case 'facilitator':
                return 'badge-warning';
            case 'member':
                return 'badge-neutral';
            default:
                return 'badge-ghost';
        }
    }
</script>

<div class="space-y-6">
    <h3 class="text-lg font-medium text-gray-900">
        User Management
    </h3>

    <!-- Add User Section -->
    {#if currentUserRole === 'admin'}
        <div class="border rounded-lg p-4 bg-gray-50">
            <h4 class="text-sm font-medium text-gray-700 mb-3">Add User</h4>
            <div class="flex gap-2">
                <input
                    type="email"
                    bind:value={newUserEmail}
                    placeholder="Enter user email..."
                    class="input input-bordered flex-1 input-sm"
                    disabled={addingUser}
                    onkeydown={(e) => {
                        if (e.key === 'Enter') handleAddUser();
                    }}
                />
                <button
                    onclick={handleAddUser}
                    disabled={addingUser || !newUserEmail.trim()}
                    class="btn btn-primary btn-sm"
                >
                    {#if addingUser}
                        <span class="loading loading-spinner loading-xs"></span>
                        Adding...
                    {:else}
                        Add User
                    {/if}
                </button>
            </div>
            {#if addUserError}
                <div class="text-error text-xs mt-2">{addUserError}</div>
            {/if}
        </div>
    {/if}

    <!-- Users List -->
    <div class="space-y-3">
        <h4 class="text-sm font-medium text-gray-700">Current Users ({users.length})</h4>
        
        {#if users.length === 0}
            <div class="text-center py-8 text-gray-500">
                <div class="text-sm">No users in this series yet</div>
            </div>
        {:else}
            <div class="space-y-2">
                {#each users as user (user.userId)}
                    <div class="flex items-center justify-between p-3 bg-white border rounded-lg">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <div class="font-medium text-sm text-gray-900 truncate">
                                    {user.userName || 'Unknown User'}
                                </div>
                                <div class="badge badge-sm {getRoleBadgeClass(user.role)}">
                                    {user.role}
                                </div>
                            </div>
                            <div class="text-xs text-gray-500">
                                {user.email} • Joined {new Date(user.joinedAt).toLocaleDateString()}
                            </div>
                        </div>

                        <div class="flex items-center gap-2 ml-4">
                            {#if canModifyUser(user.role)}
                                <select
                                    value={user.role}
                                    onchange={(e) => onUserRoleChanged(user.userId, e.target.value)}
                                    class="select select-bordered select-xs"
                                >
                                    <option value="member">Member</option>
                                    <option value="facilitator">Facilitator</option>
                                    <option value="admin">Admin</option>
                                </select>
                            {/if}

                            {#if canRemoveUser(user.role)}
                                <button
                                    onclick={() => onUserRemoved(user.userId)}
                                    class="btn btn-ghost btn-xs text-error"
                                    title="Remove user"
                                    aria-label="Remove user"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
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
    <div class="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
        <div class="font-medium mb-1">Role Permissions:</div>
        <ul class="space-y-1 ml-2">
            <li><strong>Admin:</strong> Full access - can manage users, boards, and series settings</li>
            <li><strong>Facilitator:</strong> Can create/manage boards and see draft boards</li>
            <li><strong>Member:</strong> Can participate in active and completed boards</li>
        </ul>
    </div>
</div>
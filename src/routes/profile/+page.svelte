<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    
    let user: any = $state(null);
    let loading = $state(true);
    let saving = $state(false);
    let message = $state("");
    let error = $state("");
    
    // Form fields
    let name = $state("");
    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    
    // Delete account
    let showDeleteConfirm = $state(false);
    let deleteConfirmText = $state("");
    
    onMount(async () => {
        try {
            const response = await fetch("/api/auth/me");
            if (response.ok) {
                const data = await response.json();
                user = data.user;
                name = user.name || "";
            } else {
                window.location.href = "/login";
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            loading = false;
        }
    });
    
    async function updateProfile() {
        saving = true;
        error = "";
        message = "";
        
        try {
            const response = await fetch("/api/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            
            if (response.ok) {
                const data = await response.json();
                user = data.user;
                message = "Profile updated successfully!";
            } else {
                const data = await response.json();
                error = data.error || "Failed to update profile";
            }
        } catch (err) {
            error = "Failed to update profile";
        } finally {
            saving = false;
        }
    }
    
    async function changePassword() {
        saving = true;
        error = "";
        message = "";
        
        if (newPassword !== confirmPassword) {
            error = "Passwords do not match";
            saving = false;
            return;
        }
        
        if (newPassword.length < 8) {
            error = "Password must be at least 8 characters";
            saving = false;
            return;
        }
        
        try {
            const response = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });
            
            if (response.ok) {
                message = "Password changed successfully!";
                currentPassword = "";
                newPassword = "";
                confirmPassword = "";
            } else {
                const data = await response.json();
                error = data.error || "Failed to change password";
            }
        } catch (err) {
            error = "Failed to change password";
        } finally {
            saving = false;
        }
    }
    
    async function deleteAccount() {
        if (deleteConfirmText !== "DELETE MY ACCOUNT") {
            error = "Please type 'DELETE MY ACCOUNT' to confirm";
            return;
        }
        
        saving = true;
        error = "";
        
        try {
            const response = await fetch("/api/auth/delete-account", {
                method: "DELETE"
            });
            
            if (response.ok) {
                window.location.href = "/";
            } else {
                const data = await response.json();
                error = data.error || "Failed to delete account";
            }
        } catch (err) {
            error = "Failed to delete account";
        } finally {
            saving = false;
        }
    }
</script>

<div class="profile-container">
    {#if loading}
        <div class="loading-container">
            <div class="loading-spinner"></div>
        </div>
    {:else if user}
        <div class="profile-content">
            <h1 class="profile-title">Profile Settings</h1>
            
            {#if message}
                <div class="alert alert-success">
                    <Icon name="check" size="sm" />
                    {message}
                </div>
            {/if}
            
            {#if error}
                <div class="alert alert-error">
                    <Icon name="alert" size="sm" />
                    {error}
                </div>
            {/if}
            
            <!-- Profile Information -->
            <section class="profile-section">
                <h2 class="section-title">Profile Information</h2>
                <div class="form-group">
                    <label for="email" class="form-label">Email</label>
                    <input
                        type="email"
                        id="email"
                        class="input"
                        value={user.email}
                        disabled
                    />
                    <p class="form-help">Email cannot be changed</p>
                </div>
                
                <div class="form-group">
                    <label for="name" class="form-label">Name</label>
                    <input
                        type="text"
                        id="name"
                        class="input"
                        bind:value={name}
                        placeholder="Enter your name"
                    />
                </div>
                
                <button
                    class="btn-primary"
                    onclick={updateProfile}
                    disabled={saving}
                >
                    {saving ? "Saving..." : "Update Profile"}
                </button>
            </section>
            
            <!-- Change Password -->
            <section class="profile-section">
                <h2 class="section-title">Change Password</h2>
                <div class="form-group">
                    <label for="current-password" class="form-label">Current Password</label>
                    <input
                        type="password"
                        id="current-password"
                        class="input"
                        bind:value={currentPassword}
                        placeholder="Enter current password"
                    />
                </div>
                
                <div class="form-group">
                    <label for="new-password" class="form-label">New Password</label>
                    <input
                        type="password"
                        id="new-password"
                        class="input"
                        bind:value={newPassword}
                        placeholder="Enter new password (min. 8 characters)"
                    />
                </div>
                
                <div class="form-group">
                    <label for="confirm-password" class="form-label">Confirm New Password</label>
                    <input
                        type="password"
                        id="confirm-password"
                        class="input"
                        bind:value={confirmPassword}
                        placeholder="Confirm new password"
                    />
                </div>
                
                <button
                    class="btn-primary"
                    onclick={changePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                >
                    {saving ? "Changing..." : "Change Password"}
                </button>
            </section>
            
            <!-- Delete Account -->
            <section class="profile-section danger-section">
                <h2 class="section-title section-title-danger">Danger Zone</h2>
                <div class="danger-content">
                    <div>
                        <h3 class="danger-title">Delete Account</h3>
                        <p class="danger-text">
                            Once you delete your account, there is no going back. 
                            This will permanently delete your account and all associated data.
                        </p>
                    </div>
                    <button
                        class="btn-danger"
                        onclick={() => showDeleteConfirm = true}
                    >
                        Delete Account
                    </button>
                </div>
                
                {#if showDeleteConfirm}
                    <div class="delete-confirm">
                        <p class="confirm-text">
                            Please type <strong>DELETE MY ACCOUNT</strong> to confirm:
                        </p>
                        <input
                            type="text"
                            class="input"
                            bind:value={deleteConfirmText}
                            placeholder="Type here to confirm"
                        />
                        <div class="confirm-actions">
                            <button
                                class="button button-secondary"
                                onclick={() => {
                                    showDeleteConfirm = false;
                                    deleteConfirmText = "";
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                class="btn-danger"
                                onclick={deleteAccount}
                                disabled={saving || deleteConfirmText !== "DELETE MY ACCOUNT"}
                            >
                                {saving ? "Deleting..." : "Delete My Account"}
                            </button>
                        </div>
                    </div>
                {/if}
            </section>
        </div>
    {/if}
</div>

<style>
    .profile-container {
        min-height: 100vh;
        padding: var(--spacing-8) var(--spacing-4);
        background: var(--color-bg-primary);
    }
    
    .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 50vh;
    }
    
    .profile-content {
        max-width: 600px;
        margin: 0 auto;
    }
    
    .profile-title {
        font-size: 2rem;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-8);
    }
    
    .profile-section {
        background: white;
        border-radius: var(--radius-lg);
        padding: var(--spacing-6);
        margin-bottom: var(--spacing-6);
        box-shadow: var(--shadow-sm);
    }
    
    .section-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-4);
    }
    
    .section-title-danger {
        color: var(--color-danger);
    }
    
    .form-group {
        margin-bottom: var(--spacing-4);
    }
    
    .form-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        margin-bottom: var(--spacing-2);
    }
    
    .form-help {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        margin-top: var(--spacing-1);
    }
    
    .alert {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-3) var(--spacing-4);
        border-radius: var(--radius-lg);
        margin-bottom: var(--spacing-4);
    }
    
    .alert-success {
        background: var(--status-success-bg);
        color: var(--status-success-text);
    }
    
    .alert-error {
        background: var(--status-error-bg);
        color: var(--status-error-text);
    }
    
    .danger-section {
        border: 1px solid var(--color-danger);
    }
    
    .danger-content {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--spacing-4);
    }
    
    .danger-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-2);
    }
    
    .danger-text {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
    }
    
    .delete-confirm {
        margin-top: var(--spacing-4);
        padding-top: var(--spacing-4);
        border-top: 1px solid var(--color-border);
    }
    
    .confirm-text {
        font-size: 0.875rem;
        color: var(--color-text-secondary);
        margin-bottom: var(--spacing-3);
    }
    
    .confirm-actions {
        display: flex;
        gap: var(--spacing-3);
        margin-top: var(--spacing-4);
    }
</style>
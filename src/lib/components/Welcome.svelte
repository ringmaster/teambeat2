<div class="welcome-page">
    <div class="welcome-container">
        <h1 class="welcome-title">Welcome to TeamBeat</h1>
        <p class="welcome-subtitle">
            Please sign in to access your retrospectives
        </p>
        <div class="welcome-actions">
            <a href="/login" class="btn-primary">Sign In</a>
            <a href="/register" class="btn-secondary">Register</a>
        </div>
    </div>
</div>

<style>
    .welcome-page {
        min-height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 var(--spacing-4);
    }

    .welcome-container {
        text-align: center;
        max-width: 32rem;
        width: 100%;
    }

    .welcome-title {
        font-size: 2.25rem;
        line-height: 2.5rem;
        font-weight: 700;
        background: linear-gradient(
            to right,
            var(--color-primary),
            var(--color-secondary)
        );
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        margin: 0 0 var(--spacing-4) 0;
    }

    .welcome-subtitle {
        color: var(--color-text-muted);
        font-size: 1.125rem;
        margin: 0 0 var(--spacing-8) 0;
    }

    .welcome-actions {
        display: flex;
        gap: var(--spacing-4);
        justify-content: center;
        flex-wrap: wrap;
    }
</style>
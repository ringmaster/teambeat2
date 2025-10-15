import { parseRPNString } from './rpn-parser';
import { evaluateRPN } from './rpn-evaluator';

/**
 * Build the data context for display rule RPN evaluation
 */
export function buildDisplayRuleContext(
    board: any,
    scene: any,
    cards: any[],
    agreements?: any[],
    lastHealthCheckDate?: string | null
): Record<string, any> {
    // Build columns object with card data
    const columns: Record<string, any> = {};

    if (board?.allColumns || board?.columns) {
        const boardColumns = board.allColumns || board.columns;
        boardColumns.forEach((column: any) => {
            // Get cards for this column
            const columnCards = cards.filter(card => card.columnId === column.id);

            columns[column.title] = {
                id: column.id,
                title: column.title,
                cards: columnCards
            };
        });
    }

    // Build agreements data
    const agreementsData = agreements || [];
    const incompleteAgreements = agreementsData.filter(a => !a.completed);
    const completedAgreements = agreementsData.filter(a => a.completed);

    return {
        board: {
            title: board?.name || '',
            status: board?.status || 'draft',
            blameFreeMode: board?.blameFreeMode || false
        },
        scene: {
            title: scene?.title || '',
            mode: scene?.mode || 'columns'
        },
        columns,
        agreements: {
            all: agreementsData,
            incomplete: incompleteAgreements,
            completed: completedAgreements,
            totalCount: agreementsData.length,
            incompleteCount: incompleteAgreements.length,
            completedCount: completedAgreements.length
        },
        seriesId: board?.seriesId,
        lastHealthCheckDate: lastHealthCheckDate !== undefined ? lastHealthCheckDate : null
    };
}

/**
 * Evaluate a scene's display rule
 * Returns true if scene should be displayed, false if it should be skipped
 */
export function evaluateDisplayRule(
    scene: any,
    board: any,
    cards: any[],
    agreements?: any[],
    lastHealthCheckDate?: string | null
): boolean {
    // If no display rule, always show the scene
    if (!scene?.displayRule || scene.displayRule.trim() === '') {
        return true;
    }

    try {
        // Build the context for evaluation
        const context = buildDisplayRuleContext(board, scene, cards, agreements, lastHealthCheckDate);

        console.log(`[Display Rule] Evaluating scene "${scene.title}"`, {
            rule: scene.displayRule,
            agreementsCount: agreements?.length || 0,
            contextAgreements: context.agreements
        });

        // Parse the RPN expression
        const expression = parseRPNString(scene.displayRule);

        // Evaluate the expression
        const result = evaluateRPN(expression, context);

        if (!result.success) {
            console.error(`Display rule evaluation failed for scene "${scene.title}":`, result.error);
            console.error('Stack trace:', result.stackTrace);
            // On error, default to showing the scene
            return true;
        }

        console.log(`[Display Rule] Scene "${scene.title}" result:`, result.value);

        // Convert result to boolean
        // If result is already boolean, use it
        // If it's a number, treat 0 as false, anything else as true
        // If it's a string, treat empty string as false, anything else as true
        // If it's null/undefined, treat as false
        const value = result.value;
        if (typeof value === 'boolean') {
            return value;
        } else if (typeof value === 'number') {
            return value !== 0;
        } else if (typeof value === 'string') {
            return value !== '';
        } else if (value === null || value === undefined) {
            return false;
        } else {
            // For objects/arrays, truthy if not empty
            return true;
        }
    } catch (error) {
        console.error(`Error evaluating display rule for scene "${scene.title}":`, error);
        // On error, default to showing the scene
        return true;
    }
}

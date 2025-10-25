/**
 * Template system for board creation
 *
 * Templates can include:
 * - Static column descriptions
 * - Dynamic column descriptions via getDescription() function
 * - Default appearance settings for columns
 * - Scene configurations
 */

import { COLUMN_PRESETS } from "$lib/data/column-presets";
import { SCENE_FLAGS, type SceneFlag } from "$lib/scene-flags";

/**
 * Get a random description for a column from the presets
 * @param columnTitle The title of the column to get a description for
 * @returns A random description from the preset list, or empty string if no presets available
 */
function getRandomColumnDescription(columnTitle: string): string {
	const presets = COLUMN_PRESETS[columnTitle];
	if (!presets || presets.length === 0) {
		return "";
	}
	return presets[Math.floor(Math.random() * presets.length)];
}

// Type definitions for template structure
interface TemplateColumn {
	title: string;
	description?: string; // Static description
	seq: number;
	default_appearance?: string;
	getDescription?: () => string; // Dynamic description function (overrides static description)
}

interface TemplateScene {
	title: string;
	description?: string; // Optional description/markdown content for the scene
	mode:
		| "columns"
		| "present"
		| "review"
		| "agreements"
		| "scorecard"
		| "static"
		| "survey";
	seq: number;
	displayRule?: string; // Optional RPN expression to conditionally display this scene
	flags: SceneFlag[]; // Array of scene flags from SCENE_FLAGS constants
	visibleColumns?: string[]; // Optional array of column titles that should be visible (if omitted, all columns are visible)
}

interface BoardTemplate {
	id: string;
	name: string;
	description: string;
	columns: TemplateColumn[];
	scenes: TemplateScene[];
}

export const BOARD_TEMPLATES: Record<string, BoardTemplate> = {
	kafe: {
		id: "kafe",
		name: "KAFE (Kvetches, Appreciations, Flaws, Experiments)",
		description:
			'A "KAFE" retrospective is a structured approach used in project management and team-building to reflect on the past and plan for the future.',
		columns: [
			{ title: "Kvetches", description: "What really bothered you?", seq: 1 },
			{
				title: "Appreciations",
				description: "What/Who really pleased you?",
				seq: 2,
			},
			{ title: "Flaws", description: "What could be improved?", seq: 3 },
			{
				title: "Experiments",
				description: "What should we try differently?",
				seq: 4,
			},
		],
		scenes: [
			{
				title: "About KAFE",
				description:
					'# KAFE Retrospective\n\nA "KAFE" retrospective is a structured approach used in project management and team-building to reflect on the past and plan for the future. The name is an acronym that stands for:\n\n## The Four Columns\n\n**Kvetches** - What really bothered you?\n- Share frustrations, annoyances, and pain points from the iteration\n- This is a safe space to vent about what didn\'t work\n- Unlike "Mad" in other formats, kvetching has a lighter, almost therapeutic quality\n\n**Appreciations** - What/Who really pleased you?\n- Recognize team members, processes, or outcomes that went well\n- Celebrate wins, both big and small\n- Build team morale by acknowledging contributions\n\n**Flaws** - What could be improved?\n- Identify systemic issues and process weaknesses\n- Focus on actionable problems rather than complaints\n- Think about root causes, not just symptoms\n\n**Experiments** - What should we try differently?\n- Propose concrete actions and changes\n- Frame improvements as experiments to reduce fear of failure\n- Commit to trying new approaches in the next iteration\n\n## How This Retrospective Works\n\nThe KAFE format balances emotional expression (Kvetches, Appreciations) with analytical thinking (Flaws, Experiments). This approach:\n\n1. **Acknowledges feelings first** - Letting people kvetch and appreciate creates psychological safety\n2. **Moves to analysis** - Identifying flaws helps the team think critically about processes\n3. **Ends with action** - Experiments give the team concrete next steps\n\nThis retrospective works well for teams that value both emotional intelligence and continuous improvement.\n\n---\n\n**Note:** This "About" scene only appears when the board is in Draft status. Once you activate the board, it will be automatically hidden. If you don\'t want this informational scene at all, you can delete it using the scene configuration settings.',
				mode: "static" as const,
				seq: 0,
				displayRule: '$.board.status "draft" eq',
				flags: [],
			},
			{
				title: "Gather",
				mode: "columns" as const,
				seq: 1,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_OBSCURE_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
				],
			},
			{
				title: "Group",
				mode: "columns" as const,
				seq: 2,
				flags: [
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Kvetch",
				mode: "present" as const,
				seq: 3,
				flags: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
				visibleColumns: ["Kvetches"],
			},
			{
				title: "Vote",
				mode: "columns" as const,
				seq: 4,
				flags: [
					SCENE_FLAGS.ALLOW_VOTING,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
				visibleColumns: ["Flaws", "Experiments"],
			},
			{
				title: "Discuss",
				mode: "present" as const,
				seq: 5,
				flags: [
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
				visibleColumns: ["Flaws", "Experiments"],
			},
			{
				title: "Appreciate",
				mode: "present" as const,
				seq: 6,
				flags: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
				visibleColumns: ["Appreciations"],
			},
			{
				title: "Review",
				mode: "review" as const,
				seq: 7,
				flags: [SCENE_FLAGS.SHOW_VOTES],
			},
		],
	},
	leancoffee: {
		id: "leancoffee",
		name: "Lean Coffee",
		description:
			"A democratic discussion format where topics are proposed, discussed, and decided on.",
		columns: [
			{
				title: "Icebreaker",
				seq: 1,
				default_appearance: "locked",
				getDescription: () => getRandomColumnDescription("Icebreaker"),
			},
			{ title: "Issues to Discuss", seq: 2, default_appearance: "spread" },
		],
		scenes: [
			{
				title: "About Lean Coffee",
				description:
					'# Lean Coffee\n\nLean Coffee is a structured but agenda-less meeting format that was created in Seattle in 2009. It applies Lean principles to create focused, productive discussions that are driven entirely by participant interest.\n\n## The Lean Coffee Process\n\n**1. Propose Topics** (5-10 minutes)\n- Everyone silently adds topics they want to discuss as cards\n- Topics can be questions, issues, ideas, or anything relevant to the group\n- Brief clarification is allowed, but no deep discussion yet\n- The Icebreaker column helps people get comfortable sharing\n\n**2. Review Last Time** (if applicable)\n- Check on action items and decisions from previous sessions\n- This scene only appears when there are outstanding agreements\n- Ensures accountability and follow-through\n\n**3. Vote on Topics** (2-3 minutes)\n- Everyone votes on which topics they\'re most interested in discussing\n- Usually 2-3 votes per person (dot voting)\n- Creates a democratic prioritization of what matters most to the group\n\n**4. Discuss Topics** (bulk of meeting time)\n- Start with the highest-voted topic\n- Use timeboxes (typically 5-8 minutes per topic)\n- When time expires, do a quick "thumbs up/down/sideways" vote:\n  - 👍 Continue discussing (add 2-3 more minutes)\n  - 👎 Move to next topic\n  - 👉 No strong opinion\n- This keeps discussions focused and prevents one topic from dominating\n\n**5. Review Topics**\n- Summarize key decisions and action items\n- Note any topics that didn\'t get discussed (can be carried forward)\n- Capture agreements for next time\n\n## Why Lean Coffee Works\n\n- **Democratic**: Everyone has equal voice in setting the agenda\n- **Focused**: Timeboxing prevents rambling discussions\n- **Engaging**: People discuss what they actually care about\n- **Adaptive**: The format works for any group size or topic domain\n- **Lightweight**: Minimal preparation required\n\n## Best Practices\n\n- **Keep it timeboxed**: Strict time limits create urgency and focus\n- **Stay on topic**: Park tangential discussions for later\n- **Capture decisions**: Write down action items and agreements as you go\n- **Rotate facilitation**: Let different people lead different sessions\n\nLean Coffee works great for team check-ins, community meetups, learning groups, and any situation where you want productive discussion without a pre-set agenda.\n\n---\n\n**Note:** This "About" scene only appears when the board is in Draft status. Once you activate the board, it will be automatically hidden. If you don\'t want this informational scene at all, you can delete it using the scene configuration settings.',
				mode: "static" as const,
				seq: 0,
				displayRule: '$.board.status "draft" eq',
				flags: [],
			},
			{
				title: "Propose Topics",
				mode: "columns" as const,
				seq: 1,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Review Last Time",
				description:
					"Review outstanding action items from the previous meeting",
				mode: "agreements" as const,
				seq: 2,
				displayRule: "$.agreements.totalCount 0 gt",
				flags: [],
				visibleColumns: ["Issues to Discuss"],
			},
			{
				title: "Vote on Topics",
				mode: "columns" as const,
				seq: 3,
				flags: [
					SCENE_FLAGS.ALLOW_VOTING,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
				visibleColumns: ["Issues to Discuss"],
			},
			{
				title: "Discuss Topics",
				mode: "present" as const,
				seq: 4,
				flags: [
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
				visibleColumns: ["Issues to Discuss"],
			},
			{
				title: "Review Topics",
				mode: "review" as const,
				seq: 5,
				flags: [SCENE_FLAGS.SHOW_VOTES, SCENE_FLAGS.SHOW_COMMENTS],
			},
		],
	},
	traction: {
		id: "traction",
		name: "Traction Touchbase",
		description:
			"A structured meeting format to discuss key issues and plan actions.",
		columns: [{ title: "Issues List", seq: 1 }],
		scenes: [
			{
				title: "About Traction",
				description:
					"# Traction Touchbase\n\nThe Traction Touchbase (also called the Level 10 Meeting) is based on the EOS (Entrepreneurial Operating System) framework from Gino Wickman's book \"Traction.\" This highly structured meeting format helps teams maintain focus, accountability, and momentum week after week.\n\n## The Traction Meeting Structure\n\n**1. To-Do List**\n- Review action items (To-Dos) from the previous meeting\n- Report completion status for each item\n- **Goal**: 90%+ completion rate demonstrates team accountability\n- Incomplete items either get completed this week or become issues to discuss\n\n**2. Scorecard**\n- Review 5-15 key measurables (metrics) that predict success\n- Each metric has an owner and a weekly goal\n- Off-track metrics become issues for the Issue List\n- **Purpose**: Leading indicators help you spot problems before they become crises\n\n**3. Issue List**\n- Everyone adds current issues, obstacles, and opportunities\n- Issues can come from:\n  - Incomplete To-Dos\n  - Off-track Scorecard metrics\n  - Headlines from around the business\n  - New challenges or opportunities\n- **Keep it short**: Just capture the issue, don't discuss yet\n\n**4. IDS - Identify, Discuss, Solve**\n- The heart of the meeting - systematic problem-solving\n- **Identify**: Prioritize issues (most important/urgent first)\n- **Discuss**: Get to the root cause (not just symptoms)\n- **Solve**: Create specific action items (To-Dos) with owners and due dates\n\nThe IDS process:\n1. Pick the top 1-3 issues (don't insist on solving every issue)\n2. Discuss until you understand the real problem\n3. Decide on concrete next steps\n4. Document To-Dos with clear owners\n5. Move on to the next issue\n\n**5. Close**\n- Review new To-Dos to ensure clarity\n- Identify any messages to cascade to other teams\n- Rate the meeting 1-10 (aim for \"Level 10\")\n- End on time, every time\n\n## Why This Format Works\n\n- **Consistent structure**: Same agenda every time builds discipline\n- **Data-driven**: Scorecard provides objective health indicators\n- **Issue-focused**: Solves real problems instead of just reporting status\n- **Accountable**: To-Do review creates peer accountability\n- **Efficient**: Strict timeboxing respects everyone's time\n\n## Best Practices\n\n- **Same time each time**: Cadence builds momentum\n- **15 minutes, no more**: Strict time limit forces prioritization\n- **All core team members present**: No skipping, no delegates\n- **Stay in IDS**: Don't let discussion wander outside the framework\n- **Solve don't just discuss**: Every issue needs action items\n- **Use a scorecard**: Data beats opinions for identifying problems\n\n## Who Should Use This\n\nThe Traction Touchbase works best for:\n- Leadership teams running a business unit or company\n- Cross-functional teams solving complex problems\n- Teams that value discipline and accountability\n- Organizations using or interested in EOS principles\n\nThis meeting format transforms weekly team meetings from status updates into strategic problem-solving sessions.\n\n---\n\n**Note:** This \"About\" scene only appears when the board is in Draft status. Once you activate the board, it will be automatically hidden. If you don't want this informational scene at all, you can delete it using the scene configuration settings.",
				mode: "static" as const,
				seq: 0,
				displayRule: '$.board.status "draft" eq',
				flags: [],
			},
			{
				title: "To-Do List",
				mode: "agreements" as const,
				seq: 1,
				flags: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
			},
			{
				title: "Scorecard",
				mode: "scorecard" as const,
				seq: 2,
				displayRule: "$.scene.scorecardCount 0 gt",
				flags: [],
				visibleColumns: [],
			},
			{
				title: "Issue List",
				mode: "columns" as const,
				seq: 3,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Identify, Discuss, Solve (IDS)",
				mode: "present" as const,
				seq: 4,
				flags: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
			},
			{
				title: "Close",
				mode: "review" as const,
				seq: 5,
				flags: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
			},
		],
	},
	startstop: {
		id: "startstop",
		name: "Start, Stop, Continue",
		description:
			"Focus on behaviors to start, stop, and continue for the next iteration.",
		columns: [
			{ title: "Start", description: "(What should we begin doing?)", seq: 1 },
			{ title: "Stop", description: "(What should we cease doing?)", seq: 2 },
			{
				title: "Continue",
				description: "(What should we keep doing?)",
				seq: 3,
			},
		],
		scenes: [
			{
				title: "About Start-Stop-Continue",
				description:
					'# Start, Stop, Continue\n\nStart-Stop-Continue is one of the simplest and most effective retrospective formats. Its power lies in its clarity - three straightforward questions that drive actionable change.\n\n## The Three Columns\n\n**Start** - What should we begin doing?\n- New practices, tools, or approaches to try\n- Behaviors we\'ve been avoiding but should adopt\n- Fresh ideas inspired by recent challenges\n- Experiments worth testing in the next iteration\n\n**Examples:**\n- Start doing daily standups\n- Start writing more unit tests\n- Start celebrating small wins\n- Start documenting our decisions\n\n**Stop** - What should we cease doing?\n- Practices that waste time or energy\n- Meetings that don\'t add value\n- Processes that create friction\n- Behaviors that hurt team dynamics\n\n**Examples:**\n- Stop having meetings without agendas\n- Stop waiting until the last minute to test\n- Stop interrupting each other during discussions\n- Stop working overtime to meet unrealistic deadlines\n\n**Continue** - What should we keep doing?\n- Practices that are working well\n- Behaviors that strengthen the team\n- Processes that deliver value\n- Anything we don\'t want to lose\n\n**Examples:**\n- Continue pair programming on complex features\n- Continue the Friday knowledge-sharing sessions\n- Continue asking for help when stuck\n- Continue the quick daily check-ins\n\n## The Retrospective Flow\n\n**1. Brainstorm** (15-20 minutes)\n- Everyone adds cards to all three columns\n- Think about the whole iteration - what worked, what didn\'t\n- Be specific: "Start doing X" is better than "Better communication"\n- Silent brainstorming prevents groupthink\n\n**2. Prioritize** (10 minutes)\n- Group similar items together\n- Vote on which items matter most\n- Focus on what will have the biggest impact\n- Don\'t try to change everything at once\n\n**3. Discuss** (20-30 minutes)\n- Work through the highest-voted items\n- Understand why people suggested each item\n- Build consensus on which changes to make\n- Surface any concerns or obstacles\n\n**4. Plan Actions** (10-15 minutes)\n- Commit to 2-3 specific changes for the next iteration\n- Assign owners to action items\n- Make commitments concrete and measurable\n- Document decisions\n\n## Why This Format Works\n\n- **Simple**: Three clear questions anyone can answer\n- **Balanced**: Covers what\'s working and what needs change\n- **Action-oriented**: Naturally produces concrete next steps\n- **Positive**: "Continue" column keeps focus on strengths\n- **Flexible**: Works for any team size or domain\n- **Quick**: Can be done in 45-60 minutes\n\n## Best Practices\n\n**Be Specific**\n- ❌ "Better communication"\n- ✅ "Start using Slack threads for important discussions"\n\n**Focus on Behavior**\n- Talk about what people do, not who they are\n- Frame items as actions, not judgments\n\n**Limit Your Commitments**\n- Pick 2-3 items max to act on\n- Better to do a few things well than many things poorly\n- You can always address more items in the next retro\n\n**Make "Stop" Safe**\n- Sometimes the best improvement is removing waste\n- Don\'t defend existing practices just because they\'re comfortable\n- Frame stops as experiments, not failures\n\n**Celebrate "Continue"**\n- This column is often overlooked but crucial\n- Acknowledging what works prevents regression\n- Builds confidence and team morale\n\n## When to Use This Format\n\n**Ideal for:**\n- Teams new to retrospectives\n- Short iterations (1-2 weeks)\n- Action-focused teams who dislike abstract discussions\n- When you need quick, practical improvements\n- Teams experiencing change fatigue\n\n**Less ideal for:**\n- Deep emotional processing (try Mad-Sad-Glad instead)\n- Understanding complex systemic issues\n- Teams stuck in a rut (might need more creative format)\n\nStart-Stop-Continue is the Swiss Army knife of retrospective formats - reliable, practical, and effective in most situations.\n\n---\n\n**Note:** This "About" scene only appears when the board is in Draft status. Once you activate the board, it will be automatically hidden. If you don\'t want this informational scene at all, you can delete it using the scene configuration settings.',
				mode: "static" as const,
				seq: 0,
				displayRule: '$.board.status "draft" eq',
				flags: [],
			},
			{
				title: "Brainstorm",
				mode: "columns" as const,
				seq: 1,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.SHOW_COMMENTS,
				],
			},
			{
				title: "Prioritize",
				mode: "columns" as const,
				seq: 2,
				flags: [
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.ALLOW_VOTING,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Discuss",
				mode: "present" as const,
				seq: 3,
				flags: [
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Plan Actions",
				mode: "review" as const,
				seq: 4,
				flags: [SCENE_FLAGS.SHOW_VOTES, SCENE_FLAGS.SHOW_COMMENTS],
			},
		],
	},
	madsadglad: {
		id: "madsadglad",
		name: "Mad, Sad, Glad",
		description:
			"An emotional retrospective focusing on feelings and reactions.",
		columns: [
			{ title: "Mad", description: "(What frustrated us?)", seq: 1 },
			{ title: "Sad", description: "(What disappointed us?)", seq: 2 },
			{ title: "Glad", description: "(What made us happy?)", seq: 3 },
		],
		scenes: [
			{
				title: "About Mad-Sad-Glad",
				description:
					'# Mad, Sad, Glad\n\nMad-Sad-Glad is an emotional retrospective format that acknowledges feelings as valid data. Unlike task-focused retrospectives, this format helps teams process the emotional experience of their work together.\n\n## The Three Emotional Columns\n\n**Mad** - What frustrated us?\n- Things that made you angry, annoyed, or irritated\n- Blockers and obstacles that got in your way\n- Decisions or events that felt unfair\n- Moments when you felt disrespected or unheard\n\n**Why it matters:**\n- Acknowledging frustration prevents it from festering\n- Surfacing anger in a safe space builds trust\n- Understanding what makes people mad helps prevent future conflicts\n\n**Sad** - What disappointed us?\n- Expectations that weren\'t met\n- Opportunities we missed\n- Goals we didn\'t achieve\n- Things we wish had gone differently\n\n**Why it matters:**\n- Disappointment reveals what people care about\n- Processing sadness together builds empathy\n- Acknowledging losses helps teams move forward\n\n**Glad** - What made us happy?\n- Successes worth celebrating\n- Moments of pride or satisfaction  \n- Pleasant surprises\n- Times when things went better than expected\n\n**Why it matters:**\n- Celebrating wins builds team morale\n- Recognizing success reinforces positive behaviors\n- Gratitude creates psychological safety\n\n## How This Retrospective Works\n\n**1. Share Feelings** (20 minutes)\n- Everyone adds cards describing their emotional experiences\n- Be honest but kind - focus on events, not people\n- It\'s okay to have cards in multiple columns about the same topic\n- Silent writing time prevents emotional contagion\n\n**2. Prioritize** (10 minutes)\n- Group similar feelings together\n- Vote on which emotional themes to explore\n- Look for patterns - are many people feeling the same way?\n\n**3. Explore Together** (25 minutes)\n- Discuss the highest-voted items\n- Listen to understand, not to fix immediately\n- Ask "why did this make you feel that way?"\n- Build shared understanding of the emotional landscape\n\n**4. Find Solutions** (15 minutes)\n- Identify actionable improvements\n- What can we change to address the "mad" items?\n- How can we prevent future "sad" situations?\n- How can we create more "glad" moments?\n\n## Why This Format Works\n\n**Psychological Safety**\n- Naming emotions explicitly makes them discussable\n- Everyone\'s feelings are valid and heard\n- Creates permission to be human at work\n\n**Early Warning System**\n- Emotions often surface before concrete problems\n- Frustrated people become disengaged people\n- Addressing feelings prevents bigger issues\n\n**Team Bonding**\n- Sharing emotions builds trust\n- Empathy grows from understanding others\' experiences\n- Celebrating together strengthens relationships\n\n## Facilitator Tips\n\n**Create Safety**\n- Remind everyone: feelings aren\'t right or wrong\n- Use "I" statements: "I felt frustrated when..." not "You made me angry"\n- Model vulnerability by sharing your own emotions\n\n**Balance the Columns**\n- Don\'t let "mad" dominate the conversation\n- Make sure "glad" gets equal time\n- "Sad" often needs the most gentle handling\n\n**Bridge to Action**\n- Feelings are data, but they need to lead somewhere\n- Ask: "What would need to change for this to feel different?"\n- Turn emotional insights into concrete improvements\n\n**Watch for Patterns**\n- One person mad → individual issue to address\n- Everyone mad about the same thing → systemic problem\n- Only one person glad → team morale issue\n\n## When to Use This Format\n\n**Ideal for:**\n- After particularly stressful iterations\n- When team morale seems low\n- Building psychological safety in new teams\n- Processing difficult changes or setbacks\n- Teams that value emotional intelligence\n\n**Use with care when:**\n- Trust is very low (people might not share honestly)\n- Recent interpersonal conflict (might need mediation first)\n- Team is very task-focused (might dismiss feelings as "too soft")\n\n**Tips for skeptical teams:**\n- Frame it as "what worked, what didn\'t, and why"\n- Emphasize that emotions = early indicators of problems\n- Show how addressing feelings prevents bigger issues\n\n## Common Pitfalls to Avoid\n\n❌ **Dismissing feelings**: "You shouldn\'t feel that way"\n✅ **Acknowledging**: "I hear that this situation frustrated you"\n\n❌ **Immediately problem-solving**: "Here\'s how to fix your feelings"\n✅ **Understanding first**: "Tell me more about what made you sad"\n\n❌ **Making it personal**: "You always make me angry"\n✅ **Describing events**: "I felt angry when the deadline changed"\n\nMad-Sad-Glad recognizes that teams are made of humans, and humans have feelings. By acknowledging emotions explicitly, this format helps teams build the psychological safety and empathy needed for high performance.\n\n---\n\n**Note:** This "About" scene only appears when the board is in Draft status. Once you activate the board, it will be automatically hidden. If you don\'t want this informational scene at all, you can delete it using the scene configuration settings.',
				mode: "static" as const,
				seq: 0,
				displayRule: '$.board.status "draft" eq',
				flags: [],
			},
			{
				title: "Share Feelings",
				mode: "columns" as const,
				seq: 1,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.SHOW_COMMENTS,
				],
			},
			{
				title: "Prioritize",
				mode: "columns" as const,
				seq: 2,
				flags: [
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.ALLOW_VOTING,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Explore Together",
				mode: "present" as const,
				seq: 3,
				flags: [
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Find Solutions",
				mode: "review" as const,
				seq: 4,
				flags: [SCENE_FLAGS.SHOW_VOTES, SCENE_FLAGS.SHOW_COMMENTS],
			},
		],
	},
	fourls: {
		id: "fourls",
		name: "4 L's (Liked, Learned, Lacked, Longed for)",
		description:
			"A comprehensive reflection on the four L's of team experience.",
		columns: [
			{ title: "Liked", description: "(What did we enjoy?)", seq: 1 },
			{ title: "Learned", description: "(What did we discover?)", seq: 2 },
			{ title: "Lacked", description: "(What was missing?)", seq: 3 },
			{ title: "Longed for", description: "(What did we wish for?)", seq: 4 },
		],
		scenes: [
			{
				title: "About 4 L's",
				description:
					'# Four L\'s Retrospective\n\nThe 4 L\'s retrospective (Liked, Learned, Lacked, Longed for) provides a comprehensive, balanced view of your team\'s experience. Unlike formats that focus primarily on problems, the 4 L\'s deliberately balances positives, learnings, and opportunities.\n\n## The Four Learning Columns\n\n**Liked** - What did we enjoy?\n- Aspects of the work that were satisfying\n- Successful outcomes and achievements\n- Positive team interactions\n- Things that made the work enjoyable\n- Processes or tools that worked well\n\n**Why it matters:**\n- Appreciation prevents cynicism\n- Identifying what we like helps us do more of it\n- Positive focus builds team morale\n\n**Learned** - What did we discover?\n- New skills or knowledge gained\n- Insights about the product or domain\n- Lessons from mistakes or surprises\n- Understanding gained from experiments\n- Things we now know that we didn\'t before\n\n**Why it matters:**\n- Explicit learning reinforces growth mindset\n- Sharing learnings multiplies their value\n- Celebrating discoveries makes failure safer\n\n**Lacked** - What was missing?\n- Resources we needed but didn\'t have\n- Support or information gaps\n- Tools or capabilities that would have helped\n- Time, clarity, or authority we needed\n- Skills the team doesn\'t yet possess\n\n**Why it matters:**\n- Identifying gaps is the first step to filling them\n- Understanding constraints helps prioritize investments\n- Naming what\'s missing prevents blame and frustration\n\n**Longed for** - What did we wish for?\n- Ideal scenarios or working conditions\n- Future capabilities or resources\n- Aspirational goals or outcomes\n- Better versions of current processes\n- The team or product you envision becoming\n\n**Why it matters:**\n- Aspirations reveal what the team values\n- Dreaming together builds shared vision\n- Longing creates pull toward improvement\n\n## How This Retrospective Works\n\n**1. Reflect** (15-20 minutes)\n- Everyone adds cards to all four columns\n- Encourage both specific examples and general themes\n- It\'s okay (and common) to have related items across columns\n- Example: "Liked working on Feature X, Learned how authentication works, Lacked time to document it, Longed for better documentation practices"\n\n**2. Share Insights** (15-20 minutes)\n- Read through all the cards together\n- Listen for patterns and themes\n- Ask clarifying questions\n- Notice connections between columns\n\n**3. Prioritize Improvements** (10-15 minutes)\n- Vote on which items to focus on\n- Look for intersections: What we longed for might address what we lacked\n- Learnings might show us how to get what we liked\n- Patterns across multiple people suggest high-impact areas\n\n**4. Create Action Plan** (15-20 minutes)\n- Turn insights into concrete next steps\n- Address gaps (Lacked) where possible\n- Protect what we Liked\n- Move toward what we Longed for\n- Apply what we Learned\n\n## The Power of Balance\n\nThe 4 L\'s format deliberately creates balance:\n\n**Positive + Negative**\n- Liked (positive) + Lacked (negative)\n- This prevents the retrospective from becoming either a complaint session or a celebration that ignores problems\n\n**Present + Future**\n- Learned (past/present insight) + Longed for (future aspiration)\n- This balances grounding in reality with reaching for better\n\n**Concrete + Aspirational**\n- Lacked (concrete gaps) + Longed for (aspirational vision)\n- This helps the team be both pragmatic and visionary\n\n## Why This Format Works\n\n**Growth Mindset**\n- The "Learned" column explicitly values learning\n- Celebrating discoveries makes experimentation safer\n- Creates a culture where lessons are treasured\n\n**Non-Blaming**\n- "Lacked" is about gaps, not failures\n- "Longed for" is about aspiration, not criticism\n- Framing encourages system thinking over blame\n\n**Comprehensive**\n- Four perspectives create a fuller picture\n- Less likely to miss important aspects\n- Balance prevents fixation on any one aspect\n\n**Forward-Looking**\n- "Longed for" creates pull toward improvement\n- Learning becomes fuel for future growth\n- Team develops shared vision of better future\n\n## Facilitator Tips\n\n**Make Connections**\n- "I notice we liked X but lacked Y - how are those related?"\n- "Several people learned Z - how can we share that with the wider team?"\n- "We longed for A, which might address what we lacked - let\'s explore that"\n\n**Balance the Energy**\n- If "Lacked" dominates, spend more time on "Liked" and "Longed for"\n- If discussion is too abstract, ground it with "What specifically did we learn?"\n- If too tactical, use "Longed for" to connect to bigger vision\n\n**Capture the Learning**\n- Document learnings somewhere permanent\n- Share with other teams if relevant\n- Review past learnings periodically\n- Celebrate when learnings lead to improvements\n\n## When to Use This Format\n\n**Ideal for:**\n- Learning-focused teams and organizations\n- Longer iterations (2+ weeks) with substantial learning\n- Teams working on innovation or new domains\n- When you want comprehensive, balanced reflection\n- Teaching retrospective practice to new teams\n\n**Works well for:**\n- Research or experimental work\n- Projects with significant technical learning\n- Teams building new capabilities\n- Post-launch reflections on major features\n\n**Consider alternatives when:**\n- Quick tactical improvements needed (try Start-Stop-Continue)\n- Emotional processing needed (try Mad-Sad-Glad)\n- Very short iterations with limited learning\n\n## Sample Flow\n\nA well-facilitated 4 L\'s retrospective might look like:\n\n1. **Liked**: "We liked the pairing sessions - they were effective"\n2. **Learned**: "We learned that pairing works best in 2-hour blocks"\n3. **Lacked**: "We lacked calendar time actually blocked for pairing"\n4. **Longed for**: "We longed for pairing to be our default way of working"\n5. **Action**: "Let\'s block 2-hour pairing slots 3x per week next sprint"\n\nNotice how all four L\'s contributed to finding a good action item.\n\n## Common Patterns\n\n**The Growth Loop**\n- Liked trying new thing → Learned it works → Longed for doing more → Action: make it standard\n\n**The Gap Pattern**\n- Lacked resource/skill → Learned workaround → Longed for proper solution → Action: invest in capability\n\n**The Success Reinforcement**\n- Liked outcome → Learned what enabled it → Action: do more of the enabler\n\nThe 4 L\'s format turns your team\'s experiences - both positive and negative - into fuel for continuous learning and improvement. It creates a culture where growth is expected, gaps are named without blame, and aspiration drives action.\n\n---\n\n**Note:** This "About" scene only appears when the board is in Draft status. Once you activate the board, it will be automatically hidden. If you don\'t want this informational scene at all, you can delete it using the scene configuration settings.',
				mode: "static" as const,
				seq: 0,
				displayRule: '$.board.status "draft" eq',
				flags: [],
			},
			{
				title: "Reflect",
				mode: "columns" as const,
				seq: 1,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.SHOW_COMMENTS,
				],
			},
			{
				title: "Share Insights",
				mode: "present" as const,
				seq: 2,
				flags: [SCENE_FLAGS.SHOW_COMMENTS, SCENE_FLAGS.ALLOW_COMMENTS],
			},
			{
				title: "Prioritize Improvements",
				mode: "present" as const,
				seq: 3,
				flags: [
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.ALLOW_VOTING,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
			{
				title: "Create Action Plan",
				mode: "review" as const,
				seq: 4,
				flags: [
					SCENE_FLAGS.ALLOW_ADD_CARDS,
					SCENE_FLAGS.ALLOW_EDIT_CARDS,
					SCENE_FLAGS.ALLOW_MOVE_CARDS,
					SCENE_FLAGS.ALLOW_GROUP_CARDS,
					SCENE_FLAGS.SHOW_VOTES,
					SCENE_FLAGS.SHOW_COMMENTS,
					SCENE_FLAGS.ALLOW_COMMENTS,
				],
			},
		],
	},
} as const;

// Helper function to get template list for the templates API
export function getTemplateList() {
	return Object.values(BOARD_TEMPLATES).map((template) => ({
		id: template.id,
		name: template.name,
		description: template.description,
		columns: template.columns.map((col) => col.title),
		scenes: template.scenes.length,
	}));
}

// Helper function to get full template data for setup
export function getTemplate(templateId: string): BoardTemplate {
	return BOARD_TEMPLATES[templateId] || BOARD_TEMPLATES.kafe;
}

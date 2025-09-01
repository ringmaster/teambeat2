<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	
	let user: any = $state(null);
	let series: any[] = $state([]);
	let recentBoards: any[] = $state([]);
	let loading = $state(true);
	let scrollY = $state(0);
	let newSeriesName = $state('');
	let seriesError = $state('');
	let creatingNewSeries = $state(false);
	let boardNames = $state({} as Record<string, string>); // seriesId -> board name
	let boardErrors = $state({} as Record<string, string>); // seriesId -> error message
	let creatingBoards = $state({} as Record<string, boolean>); // seriesId -> creating status
	let expandedSeries = $state({} as Record<string, boolean>); // seriesId -> expanded status
	let showDeleteModal = $state(false);
	let seriesToDelete: any = $state(null);
	
	onMount(async () => {
		window.addEventListener('scroll', () => scrollY = window.scrollY);
		try {
			const userResponse = await fetch('/api/auth/me');
			if (userResponse.ok) {
				const userData = await userResponse.json();
				user = userData.user;
				
				// Load user's series and recent boards
				const [seriesResponse, boardsResponse] = await Promise.all([
					fetch('/api/series'),
					fetch('/api/boards')
				]);
				
				if (seriesResponse.ok) {
					const seriesData = await seriesResponse.json();
					series = seriesData.series;
					
					// Initialize board names for each series
					series.forEach(s => {
						initializeBoardName(s.id, s.name);
					});
				}
				
				if (boardsResponse.ok) {
					const boardsData = await boardsResponse.json();
					recentBoards = boardsData.boards;
				}
			}
		} catch (error) {
			console.error('Failed to load dashboard data:', error);
		} finally {
			loading = false;
		}
	});
	
	async function createSeries() {
		if (!newSeriesName.trim()) {
			seriesError = 'Series name is required';
			return;
		}
		
		if (newSeriesName.trim().length < 2) {
			seriesError = 'Series name must be at least 2 characters';
			return;
		}
		
		creatingNewSeries = true;
		seriesError = '';
		
		try {
			const response = await fetch('/api/series', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newSeriesName.trim() })
			});
			
			const data = await response.json();
			
			if (response.ok) {
				// Add the new series to the existing list immediately
				series = [...series, data.series];
				// Initialize board name for the new series (same as server-side does)
				initializeBoardName(data.series.id, data.series.name);
				// Reset form
				newSeriesName = '';
			} else {
				seriesError = data.error || 'Failed to create series';
			}
		} catch (error) {
			seriesError = 'Network error. Please try again.';
		} finally {
			creatingNewSeries = false;
		}
	}
	
	
	function generateBoardName(seriesName: string): string {
		return seriesName;
	}
	
	function initializeBoardName(seriesId: string, seriesName: string) {
		if (!boardNames[seriesId]) {
			boardNames = { ...boardNames, [seriesId]: generateBoardName(seriesName) };
		}
	}
	
	async function createBoard(seriesId: string, seriesName: string) {
		const boardName = boardNames[seriesId]?.trim();
		
		if (!boardName) {
			boardErrors[seriesId] = 'Board name is required';
			return;
		}
		
		if (boardName.length < 2) {
			boardErrors[seriesId] = 'Board name must be at least 2 characters';
			return;
		}
		
		creatingBoards[seriesId] = true;
		boardErrors[seriesId] = '';
		
		try {
			const response = await fetch('/api/boards', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: boardName, seriesId })
			});
			
			const data = await response.json();
			
			if (response.ok) {
				goto(`/board/${data.board.id}`);
			} else {
				boardErrors[seriesId] = data.error || 'Failed to create board';
			}
		} catch (error) {
			boardErrors[seriesId] = 'Network error. Please try again.';
		} finally {
			creatingBoards[seriesId] = false;
		}
	}
	
	function toggleSeriesExpanded(seriesId: string) {
		expandedSeries = { ...expandedSeries, [seriesId]: !expandedSeries[seriesId] };
	}
	
	function confirmDeleteSeries(seriesItem: any) {
		seriesToDelete = seriesItem;
		showDeleteModal = true;
	}
	
	function cancelDelete() {
		showDeleteModal = false;
		seriesToDelete = null;
	}
	
	async function deleteSeries() {
		if (!seriesToDelete) return;
		
		try {
			const response = await fetch(`/api/series/${seriesToDelete.id}`, {
				method: 'DELETE'
			});
			
			if (response.ok) {
				// Remove from local state
				series = series.filter(s => s.id !== seriesToDelete.id);
				showDeleteModal = false;
				seriesToDelete = null;
			} else {
				const data = await response.json();
				const errorDetails = data.details ? `\n\nDetails: ${data.details}` : '';
				const errorType = data.type ? `\nType: ${data.type}` : '';
				alert(`${data.error || 'Failed to delete series'}${errorDetails}${errorType}`);
				console.error('Series deletion error:', data);
			}
		} catch (error) {
			alert('Network error. Please try again.');
		}
	}
</script>

{#if loading}
	<div class="hero min-h-screen">
		<div class="hero-content text-center">
			<span class="loading loading-dots loading-lg text-primary"></span>
			<p class="mt-4 text-base-content font-medium">Loading TeamBeat...</p>
		</div>
	</div>
{:else if !user}
	<!-- Hero Section -->
	<section class="relative overflow-hidden">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
			<div class="text-center space-y-8 animate-slide-up">
				<div class="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-2 rounded-full">
					<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
					<span class="text-sm font-medium text-gray-700">40+ teams running retrospectives right now</span>
				</div>
				
				<h1 class="text-5xl md:text-7xl font-black">
					<span class="gradient-text">Transform Your</span>
					<br>
					<span class="text-gray-900">Team Retrospectives</span>
				</h1>
				
				<p class="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
					Run engaging, productive retrospectives with real-time collaboration, 
					smart voting, and actionable insights.
				</p>
				
				<div class="flex flex-col sm:flex-row gap-4 justify-center">
					<a href="/register" class="btn btn-primary btn-lg">
						Get Started →
					</a>
					<a href="/login" class="btn btn-outline btn-lg">
						Sign In
					</a>
				</div>
				
				<div class="flex items-center justify-center space-x-8 text-sm text-gray-500 pt-4">
					<div class="flex items-center space-x-1">
						<svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
						</svg>
						<span>Quick setup</span>
					</div>
					<div class="flex items-center space-x-1">
						<svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
						</svg>
						<span>Easy to use</span>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Floating Elements -->
		<div class="absolute top-20 left-10 w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full opacity-20 animate-float"></div>
		<div class="absolute bottom-20 right-10 w-32 h-32 bg-gradient-to-br from-indigo-400 to-blue-400 rounded-full opacity-20 animate-float animation-delay-400"></div>
	</section>
		
	<!-- Features Section -->
	<section class="py-20 px-4">
		<div class="max-w-7xl mx-auto">
			<div class="text-center mb-16">
				<h2 class="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything you need for better retros</h2>
				<p class="text-lg text-gray-600">Powerful features designed for modern agile teams</p>
			</div>
			
			<div class="grid md:grid-cols-3 gap-8">
				<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
				<div class="card-body">
					<div class="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-6 hover:scale-110 transition-transform">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
						</svg>
					</div>
					<h3 class="card-title text-base-content">Real-time Collaboration</h3>
					<p class="text-base-content/70">Support 40+ concurrent team members with instant updates and smooth synchronization</p>
					<div class="card-actions justify-end">
						<button class="btn btn-primary btn-sm">
							Learn more
							<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
							</svg>
						</button>
					</div>
				</div>
				</div>
				
				<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
					<div class="w-14 h-14 bg-success rounded-xl flex items-center justify-center mb-6 hover:scale-110 transition-transform">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-gray-900 mb-3">Structured Workflows</h3>
					<p class="text-gray-600 leading-relaxed">Guide teams through proven retrospective formats with customizable phases and permissions</p>
					<div class="mt-6 flex items-center text-indigo-600 font-medium group-hover:text-indigo-700">
						<span>Learn more</span>
						<svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
						</svg>
					</div>
				</div>
				
				<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
					<div class="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
						</svg>
					</div>
					<h3 class="text-xl font-bold text-gray-900 mb-3">Smart Voting & Insights</h3>
					<p class="text-gray-600 leading-relaxed">Prioritize discussions with dot voting, track participation, and surface key themes</p>
					<div class="mt-6 flex items-center text-indigo-600 font-medium group-hover:text-indigo-700">
						<span>Learn more</span>
						<svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
						</svg>
					</div>
				</div>
			</div>
		</div>
	</section>
{:else}
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
		<!-- Dashboard Header -->
		<div class="bg-white rounded-2xl shadow-sm p-8">
			<div class="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
				<div>
					<h1 class="text-3xl font-bold text-gray-900">Welcome back{user?.name ? `, ${user.name}` : ''}!</h1>
					<p class="text-gray-600 mt-2">Ready to run an amazing retrospective?</p>
				</div>
				<div class="flex items-center gap-2">
					<input
						id="newSeriesInput"
						type="text"
						bind:value={newSeriesName}
						placeholder="Enter series name..."
						class="input input-bordered w-full max-w-xs"
						onkeydown={(e) => {
							if (e.key === 'Enter') createSeries();
						}}
					/>
					<button 
						onclick={createSeries}
						disabled={creatingNewSeries || !newSeriesName.trim()}
						class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if creatingNewSeries}
							<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span>Creating...</span>
						{:else}
							<span>Add</span>
						{/if}
					</button>
				</div>
			</div>
			{#if seriesError}
				<div class="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
					<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
					</svg>
					<span>{seriesError}</span>
				</div>
			{/if}
		</div>
		
		<!-- Recent Boards -->
		{#if recentBoards.length > 0}
			<div>
				<h2 class="text-xl font-bold text-gray-900 mb-4">Recent Boards</h2>
				<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each recentBoards as board}
						<a href="/board/{board.id}" class="block">
							<div class="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 border border-gray-100">
								<div class="flex items-start justify-between mb-3">
									<div>
										<h3 class="font-bold text-gray-900 text-lg">{board.name}</h3>
										<div class="flex items-center text-xs text-gray-500 mt-1">
											<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
											</svg>
											{new Date(board.createdAt).toLocaleDateString()}
										</div>
									</div>
									<span class="px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r 
										{board.status === 'active' ? 'from-green-400/20 to-emerald-400/20 text-green-700' : 
										 board.status === 'draft' ? 'from-yellow-400/20 to-amber-400/20 text-yellow-700' : 
										 'from-gray-400/20 to-slate-400/20 text-gray-700'}">
										{board.status}
									</span>
								</div>
								<p class="text-gray-600 mb-4">{board.seriesName}</p>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
		
		<!-- Board Series -->
		<div>
			<h2 class="text-xl font-bold text-gray-900 mb-4">Your Series</h2>
			{#if series.length === 0}
				<div class="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-300">
					<div class="w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
						<svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
						</svg>
					</div>
					<p class="text-gray-600 mb-4">No series yet. Create your first one to get started!</p>
					<div class="space-y-4">
						<div class="flex items-center space-x-2 justify-center">
							<input
								id="newSeriesInput"
								type="text"
								bind:value={newSeriesName}
								placeholder="Enter series name..."
								class="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-64"
								onkeydown={(e) => {
									if (e.key === 'Enter') createSeries();
								}}
							/>
							<button 
								onclick={createSeries}
								disabled={creatingNewSeries || !newSeriesName.trim()}
								class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
							>
								{#if creatingNewSeries}
									<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									<span>Creating...</span>
								{:else}
									<span>Add</span>
								{/if}
							</button>
						</div>
						{#if seriesError}
							<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
								<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
								</svg>
								<span>{seriesError}</span>
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{#each series as s}
						<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
							<div class="card-body">
								<div class="flex justify-between items-start mb-4">
									<div class="flex-1">
										<h3 class="card-title text-base-content">{s.name}</h3>
										{#if s.description}
											<p class="text-sm text-base-content/70 line-clamp-2">{s.description}</p>
										{/if}
									</div>
									<div class="flex items-center space-x-2">
										<div class="badge badge-primary">
											{s.role}
										</div>
										{#if s.role === 'admin'}
											<button
												onclick={() => confirmDeleteSeries(s)}
												class="btn btn-ghost btn-sm text-red-500 hover:bg-red-50"
												title="Delete series"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
												</svg>
											</button>
										{/if}
									</div>
								</div>
								
								<div class="space-y-3">
								<!-- Existing Boards -->
								{#if s.boards && s.boards.length > 0}
									<div class="bg-base-200 rounded-lg p-3 space-y-2">
										<h4 class="text-sm font-semibold text-base-content mb-2">Boards:</h4>
										
										<!-- Most recent board (always visible) -->
										<div class="flex items-center justify-between">
											<a 
												href="/board/{s.boards[0].id}" 
												class="link link-primary font-medium text-sm truncate"
											>
												{s.boards[0].name}
											</a>
											<div class="badge badge-sm 
												{s.boards[0].status === 'active' ? 'badge-success' : 
												 s.boards[0].status === 'draft' ? 'badge-warning' : 
												 s.boards[0].status === 'completed' ? 'badge-info' : 
												 'badge-neutral'}">
												{s.boards[0].status}
											</div>
										</div>
										
										<!-- Show more boards button if multiple boards exist -->
										{#if s.boards.length > 1}
											<button 
												onclick={() => toggleSeriesExpanded(s.id)}
												class="btn btn-ghost btn-sm text-primary"
											>
												<span>{expandedSeries[s.id] ? 'Hide' : 'Show'} {s.boards.length - 1} more board{s.boards.length > 2 ? 's' : ''}</span>
												<svg class="w-4 h-4 transform transition-transform {expandedSeries[s.id] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
												</svg>
											</button>
											
											<!-- Additional boards (collapsible) -->
											{#if expandedSeries[s.id]}
												<div class="space-y-2 pl-4 border-l-2 border-indigo-200">
													{#each s.boards.slice(1) as board}
														<div class="flex items-center justify-between">
															<a 
																href="/board/{board.id}" 
																class="text-blue-600 hover:text-blue-800 font-medium text-sm hover:underline truncate"
															>
																{board.name}
															</a>
															<span class="px-2 py-1 text-xs font-medium rounded-full 
																{board.status === 'active' ? 'bg-green-100 text-green-700' : 
																 board.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 
																 board.status === 'completed' ? 'bg-blue-100 text-blue-700' : 
																 'bg-gray-100 text-gray-700'}">
																{board.status}
															</span>
														</div>
													{/each}
												</div>
											{/if}
										{/if}
									</div>
								{:else}
									<div class="alert">
										<p class="text-sm text-base-content/70">No boards exist for this series</p>
									</div>
								{/if}
								
								<!-- Create New Board -->
								<div class="flex items-center gap-2">
									<input
										type="text"
										bind:value={boardNames[s.id]}
										placeholder="Board name..."
										class="input input-bordered flex-1 input-sm"
										onkeydown={(e) => {
											if (e.key === 'Enter') createBoard(s.id, s.name);
										}}
									/>
									<button 
										onclick={() => createBoard(s.id, s.name)}
										disabled={creatingBoards[s.id] || !boardNames[s.id]?.trim()}
										class="btn btn-success btn-sm btn-square"
										title="Add Board"
									>
										{#if creatingBoards[s.id]}
											<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
										{:else}
											+
										{/if}
									</button>
								</div>
								{#if boardErrors[s.id]}
									<div class="alert alert-error">
										<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
											<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
										</svg>
										<span>{boardErrors[s.id]}</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Delete Series Confirmation Modal -->
{#if showDeleteModal && seriesToDelete}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick={cancelDelete}>
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center space-x-3 mb-4">
				<div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
					<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
					</svg>
				</div>
				<div>
					<h3 class="text-lg font-semibold text-gray-900">Delete Series</h3>
					<p class="text-sm text-gray-600">This action cannot be undone</p>
				</div>
			</div>
			
			<div class="mb-6">
				<p class="text-gray-700 mb-4">
					Are you sure you want to delete <strong>"{seriesToDelete.name}"</strong>?
				</p>
				<div class="bg-red-50 border border-red-200 rounded-lg p-4">
					<div class="flex">
						<svg class="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
						</svg>
						<div class="text-sm text-red-800">
							<p class="font-medium">This will permanently delete:</p>
							<ul class="mt-2 list-disc list-inside space-y-1">
								<li>All boards in this series</li>
								<li>All cards, votes, and comments</li>
								<li>All series member access</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
			
			<div class="flex space-x-3">
				<button
					onclick={cancelDelete}
					class="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={deleteSeries}
					class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
				>
					Delete Series
				</button>
			</div>
		</div>
	</div>
{/if}

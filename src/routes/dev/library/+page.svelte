<script lang="ts">
	import { dev } from '$app/environment';
	import { SHOWS } from '$lib/apps/vcr/vcr-data';
	import { KINDS } from '$lib/dev/library/classify';
	import { LANGUAGES } from '$lib/dev/library/ia-client';
	import { extractYear, firstSentence } from '$lib/dev/library/parsers';
	import { setLibraryStore } from '$lib/dev/library/store.svelte';

	const store = setLibraryStore();
</script>

<svelte:head>
	<title>VCR Library — Media Search</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Pixelify+Sans:wght@400;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

{#if !dev}
	<div class="prod-warning">
		<p>This page is only available in <code>pnpm dev</code>.</p>
	</div>
{:else}
	<div class="page">
		<div class="menubar">
			<span class="apple">●</span>
			<span>VCR Library</span>
			<span class="muted">terminal.bli.net</span>
			<span class="right">Internet Archive → vcr-data.ts</span>
		</div>

		<div class="layout">
			<!-- LEFT -->
			<div class="window">
				<div class="titlebar">
					<div class="btn"></div>
					<div class="title">Search Internet Archive</div>
				</div>
				<div class="window-body">
					<h2>QUERY</h2>

					<div class="form-row">
						<label for="q">Search</label>
						<input
							id="q"
							type="text"
							bind:value={store.query}
							placeholder="e.g. computer chronicles, monkees, betty boop"
							onkeydown={(e) => e.key === 'Enter' && store.search()}
						/>
					</div>

					<div class="form-row">
						<label for="kind">Kind</label>
						<select id="kind" bind:value={store.kind}>
							{#each Object.entries(KINDS) as [key, k] (key)}
								<option value={key}>{k.label}{k.note ? ` — ${k.note}` : ''}</option>
							{/each}
						</select>
					</div>

					<div class="form-row">
						<label for="lang">Language</label>
						<select id="lang" bind:value={store.language}>
							{#each LANGUAGES as lang (lang)}
								<option value={lang}>{lang || 'Any'}</option>
							{/each}
						</select>
					</div>

					<div class="form-row">
						<label for="yfrom">Years</label>
						<input
							id="yfrom"
							type="number"
							bind:value={store.yearFrom}
							placeholder="from"
							min="1888"
							max="2100"
							class="year"
						/>
						<span class="year-sep">–</span>
						<input
							id="yto"
							type="number"
							bind:value={store.yearTo}
							placeholder="to"
							min="1888"
							max="2100"
							class="year"
						/>
						<span class="year-hint">(optional)</span>
					</div>

					<div class="form-row">
						<label for="rows">Results</label>
						<input id="rows" type="number" bind:value={store.rows} min="1" max="100" />
						<label for="safe" class="check">
							<input id="safe" type="checkbox" bind:checked={store.safeOnly} /> Safe only
						</label>
						<button class="primary" onclick={() => store.search()}>Search</button>
					</div>

					<div class="legend">
						<span><span class="tag clear">CLEAR</span> public domain / CC / curated</span>
						<span><span class="tag unknown">?</span> verify before using</span>
					</div>

					{#if store.status.msg}
						<div class="status {store.status.kind}">{store.status.msg}</div>
					{:else if store.resultSummary}
						<div class="status">{store.resultSummary}</div>
					{/if}

					<div class="results">
						{#each store.clusters as cluster (cluster.key)}
							<div class="cluster">
								<div class="cluster-head">
									<span class="cluster-icon">📺</span>
									<div class="cluster-text">
										<div class="cluster-title">{cluster.name}</div>
										<div class="cluster-sub">
											{cluster.items.length} episodes look like the same series
										</div>
									</div>
									<button
										class="primary"
										disabled={cluster.allAdded}
										onclick={() => store.importCluster(cluster)}
									>
										{#if cluster.allAdded}
											All {cluster.items.length} added ✓
										{:else if cluster.addedCount > 0}
											Import {cluster.items.length - cluster.addedCount} more
										{:else}
											Import all {cluster.items.length}
										{/if}
									</button>
								</div>
								<details class="cluster-details">
									<summary>Show {cluster.items.length} episodes</summary>
									<ul class="cluster-list">
										{#each cluster.items as it (it.identifier)}
											<li>
												<code>{it.identifier}</code>
												<span>{it.title}</span>
											</li>
										{/each}
									</ul>
								</details>
							</div>
						{/each}

						{#each store.flatResults as { item, tier, reason } (item.identifier)}
							{@const addedCount = store.episodes.filter(
								(e) => e.archiveId === item.identifier
							).length}
							{@const exp = store.expanding[item.identifier]}
							{@const year = extractYear(item)}
							<div class="result-wrap">
								<div class="result" class:added={addedCount > 0}>
									<img
										class="thumb"
										loading="lazy"
										src={`https://archive.org/services/img/${encodeURIComponent(item.identifier)}`}
										alt=""
										onerror={(e) =>
											((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
									/>
									<div class="meta">
										<div class="title">
											<span class="tag {tier}">{tier === 'clear' ? '✓' : '?'}</span>
											{item.title || item.identifier}
										</div>
										<div class="sub">
											{year || '----'} · <code>{item.identifier}</code> · {reason}
										</div>
										<div class="desc">{firstSentence(item.description, 220) || '—'}</div>
									</div>
									<div class="actions">
										<button
											class="small primary"
											disabled={!!exp?.loading || (addedCount > 0 && !exp)}
											onclick={() => store.handleAdd(item)}
										>
											{#if exp?.loading}
												Loading…
											{:else if addedCount > 0}
												Added ({addedCount})
											{:else}
												+ Add
											{/if}
										</button>
										<a
											href={`https://archive.org/details/${encodeURIComponent(item.identifier)}`}
											target="_blank"
											rel="noopener">open ↗</a
										>
									</div>
								</div>

								{#if exp?.error}
									<div class="expansion error">
										Failed to load: {exp.error}
										<button class="small" onclick={() => store.cancelExpansion(item.identifier)}>
											Dismiss
										</button>
									</div>
								{:else if exp?.files && exp.selected}
									{@const seasons = Array.from(new Set(exp.files.map((f) => f.season))).sort(
										(a, b) => a - b
									)}
									{@const selectedCount = exp.selected.size}
									<div class="expansion">
										<div class="expansion-header">
											<strong>{exp.files.length} videos found</strong> in this archive item. Pick which
											to import.
										</div>
										<div class="expansion-controls">
											<button class="small" onclick={() => store.selectAll(item.identifier, true)}>
												Select all
											</button>
											<button class="small" onclick={() => store.selectAll(item.identifier, false)}>
												Select none
											</button>
											<div class="grow"></div>
											<button class="small" onclick={() => store.cancelExpansion(item.identifier)}>
												Cancel
											</button>
											<button
												class="small primary"
												disabled={selectedCount === 0}
												onclick={() => store.addExpandedEpisodes(item)}
											>
												Import {selectedCount} episode{selectedCount === 1 ? '' : 's'}
											</button>
										</div>
										<div class="file-list">
											{#each seasons as season (season)}
												<div class="season-group">
													<div class="season-header">
														Season {season} ({exp.files.filter((f) => f.season === season).length})
													</div>
													{#each exp.files.filter((f) => f.season === season) as f (f.name)}
														<label class="file-row">
															<input
																type="checkbox"
																checked={exp.selected.has(f.name)}
																onchange={() => store.toggleFile(item.identifier, f.name)}
															/>
															<span class="file-ep">
																{f.episode > 0 ? `E${String(f.episode).padStart(2, '0')}` : '——'}
															</span>
															<span class="file-title">{f.title}</span>
															{#if f.durationSec}
																<span class="file-dur">
																	{Math.floor(f.durationSec / 60)}:{String(
																		Math.floor(f.durationSec % 60)
																	).padStart(2, '0')}
																</span>
															{/if}
														</label>
													{/each}
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/each}
						{#if store.results.length > 0 && store.shownResults.length === 0}
							<div class="empty-state">Nothing matches the current filter.</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- RIGHT -->
			<div class="window">
				<div class="titlebar">
					<div class="btn"></div>
					<div class="title">Show Being Built</div>
				</div>
				<div class="window-body">
					<div class="save-banner" class:disabled={!store.canSave}>
						<button
							class="big-save"
							disabled={!store.canSave || store.saving}
							onclick={() => store.save()}
						>
							{#if store.saving}
								Saving…
							{:else if store.episodes.length === 0}
								Add an episode →
							{:else if !store.showName.trim() || !store.showId.trim()}
								Fill in name & id →
							{:else}
								Save "{store.showName}" to VCR
							{/if}
						</button>
						<div class="save-hint">
							Writes <code>src/lib/apps/vcr/vcr-data.ts</code> directly. Refresh the VCR after.
						</div>
					</div>

					{#if store.saveResult}
						<div class="save-result {store.saveResult.ok ? 'ok' : 'err'}">
							{store.saveResult.msg}
						</div>
					{/if}

					{#if store.importFlash}
						<div class="flash">{store.importFlash}</div>
					{/if}

					<h2>SHOW METADATA</h2>

					<div class="form-row">
						<label for="sid">id</label>
						<input
							id="sid"
							type="text"
							bind:value={store.showId}
							placeholder="auto from first episode"
						/>
					</div>
					<div class="form-row">
						<label for="sname">name</label>
						<input
							id="sname"
							type="text"
							bind:value={store.showName}
							placeholder="auto from first episode"
						/>
					</div>
					<div class="form-row">
						<label for="syears">years</label>
						<input
							id="syears"
							type="text"
							bind:value={store.showYears}
							placeholder={`auto: ${store.derivedYears}`}
						/>
					</div>
					<div class="form-row align-top">
						<label for="sdesc">desc</label>
						<textarea id="sdesc" bind:value={store.showDesc} placeholder="What the show is about."
						></textarea>
					</div>

					<h2>EPISODES ({store.episodes.length})</h2>
					<ul class="episode-list">
						{#each store.episodes as ep, i (ep.id)}
							<li class="episode-item">
								<span class="ep-year">{ep.year || '----'}</span>
								<span class="ep-title" title={ep.title}>{ep.title}</span>
								<button class="small danger" title="Remove" onclick={() => store.removeEpisode(i)}
									>×</button
								>
							</li>
						{:else}
							<li class="episode-empty">No episodes yet. Click "+ Add" on a result.</li>
						{/each}
					</ul>

					<div class="controls">
						<button
							class="small"
							onclick={() => store.clearAll()}
							disabled={store.episodes.length === 0}>Clear all</button
						>
					</div>
				</div>
			</div>
		</div>

		<div class="library-section">
			<div class="window">
				<div class="titlebar">
					<div class="btn"></div>
					<div class="title">Library ({SHOWS.length})</div>
				</div>
				<div class="window-body">
					<ul class="library-list">
						{#each SHOWS as show (show.id)}
							<li class="library-item">
								<div class="lib-text">
									<div class="lib-name">{show.name}</div>
									<div class="lib-sub">
										<code>{show.id}</code> · {show.years} · {show.episodes.length} ep
									</div>
								</div>
								<button
									class="small danger"
									title="Remove from vcr-data.ts"
									onclick={() => store.removeShow(show.id, show.name)}>Remove</button
								>
							</li>
						{:else}
							<li class="library-empty">No shows yet.</li>
						{/each}
					</ul>
					<div class="lib-hint">
						Remove edits <code>vcr-data.ts</code>. Refresh the VCR after.
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(html),
	:global(body) {
		height: auto;
		overflow: auto;
	}
	:global(body) {
		margin: 0;
		background: #008080;
		background-image: radial-gradient(circle, rgba(0, 0, 0, 0.12) 1px, transparent 1px);
		background-size: 4px 4px;
		min-height: 100vh;
		font-family: 'VT323', monospace;
		color: #0a0a0a;
	}

	.prod-warning {
		max-width: 500px;
		margin: 80px auto;
		padding: 24px;
		background: #fff;
		border: 2px solid #0a0a0a;
		text-align: center;
		font-family: 'Pixelify Sans', sans-serif;
	}

	.page {
		padding: 40px 0 60px;
	}

	.menubar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 28px;
		background: #fff;
		border-bottom: 2px solid #0a0a0a;
		display: flex;
		align-items: center;
		padding: 0 12px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 16px;
		font-weight: 600;
		z-index: 100;
		gap: 16px;
	}
	.menubar .apple {
		font-size: 14px;
	}
	.menubar .muted {
		opacity: 0.45;
	}
	.menubar .right {
		margin-left: auto;
		opacity: 0.6;
		font-size: 13px;
	}

	.layout {
		max-width: 1200px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: 16px;
		padding: 0 12px;
		align-items: start;
	}
	.layout > .window:nth-child(2) {
		position: sticky;
		top: 40px;
		max-height: calc(100vh - 56px);
		overflow-y: auto;
	}

	.window {
		background: #fff;
		border: 2px solid #0a0a0a;
		box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.35);
		position: relative;
	}
	.titlebar {
		height: 22px;
		border-bottom: 2px solid #0a0a0a;
		display: flex;
		align-items: center;
		padding: 0 6px;
		background: repeating-linear-gradient(0deg, #0a0a0a 0 1px, #fff 1px 3px);
		position: relative;
	}
	.titlebar .btn {
		width: 14px;
		height: 14px;
		background: #fff;
		border: 2px solid #0a0a0a;
		z-index: 1;
		flex-shrink: 0;
	}
	.titlebar .title {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		background: #fff;
		padding: 0 8px;
		font-family: 'Pixelify Sans', sans-serif;
		font-weight: 600;
		font-size: 14px;
		white-space: nowrap;
		line-height: 1;
	}
	.window-body {
		padding: 16px;
	}

	h2 {
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		font-weight: normal;
		margin: 16px 0 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #0a0a0a;
	}

	.form-row {
		display: flex;
		gap: 8px;
		margin-bottom: 8px;
		align-items: center;
	}
	.form-row.align-top {
		align-items: flex-start;
	}
	.form-row label {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		font-weight: 600;
		min-width: 60px;
	}
	.form-row label.check {
		min-width: auto;
		cursor: pointer;
	}
	input[type='text'],
	select,
	textarea {
		font-family: 'VT323', monospace;
		font-size: 17px;
		padding: 4px 8px;
		border: 2px solid #0a0a0a;
		background: #fff;
		flex: 1;
		min-width: 0;
	}
	input[type='text']:focus,
	select:focus,
	textarea:focus {
		outline: 2px solid #f9bd2b;
		outline-offset: -2px;
	}
	textarea {
		font-size: 15px;
		resize: vertical;
		min-height: 50px;
		line-height: 1.3;
	}
	input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: #0a0a0a;
		vertical-align: middle;
	}
	input[type='number'] {
		font-family: 'VT323', monospace;
		font-size: 17px;
		padding: 4px 8px;
		border: 2px solid #0a0a0a;
		background: #fff;
		width: 70px;
	}
	input.year {
		width: 80px;
	}
	.year-sep {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 16px;
		opacity: 0.7;
	}
	.year-hint {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 12px;
		opacity: 0.5;
		margin-left: auto;
	}

	button {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 14px;
		font-weight: 600;
		padding: 6px 14px;
		border: 2px solid #0a0a0a;
		background: #fff;
		cursor: pointer;
		box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.35);
		transition:
			transform 0.05s,
			box-shadow 0.05s;
	}
	button:hover:not(:disabled) {
		background: #f9bd2b;
	}
	button:active:not(:disabled) {
		transform: translate(2px, 2px);
		box-shadow: none;
	}
	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	button.primary {
		background: #a6f000;
	}
	button.primary:hover:not(:disabled) {
		background: #f9bd2b;
	}
	button.danger {
		background: #d63030;
		color: #fff;
	}
	button.danger:hover:not(:disabled) {
		background: #f54e00;
		color: #fff;
	}
	button.small {
		font-size: 12px;
		padding: 3px 8px;
	}

	.legend {
		display: flex;
		gap: 12px;
		font-size: 12px;
		font-family: 'Pixelify Sans', sans-serif;
		margin-top: 6px;
		flex-wrap: wrap;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.tag {
		display: inline-block;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 10px;
		padding: 1px 5px;
		border: 1px solid #0a0a0a;
		margin-right: 3px;
		vertical-align: middle;
	}
	.tag.clear {
		background: #a6f000;
	}
	.tag.unknown {
		background: #f54e00;
		color: #fff;
	}

	.status {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		padding: 6px 10px;
		margin: 10px 0 8px;
		background: #faf7f0;
		border: 2px solid #0a0a0a;
	}
	.status.error {
		background: #d63030;
		color: #fff;
	}
	.status.loading {
		background: #f9bd2b;
	}

	.results {
		display: grid;
		gap: 10px;
	}
	.result {
		display: grid;
		grid-template-columns: 88px 1fr auto;
		gap: 12px;
		padding: 10px;
		border: 2px solid #0a0a0a;
		background: #fff;
		align-items: start;
	}
	.result.added {
		background: #faf7f0;
		opacity: 0.55;
	}
	.thumb {
		width: 88px;
		height: 66px;
		background: #0a0a0a;
		border: 1px solid #0a0a0a;
		object-fit: cover;
		display: block;
	}
	.meta {
		min-width: 0;
	}
	.meta .title {
		font-family: 'Pixelify Sans', sans-serif;
		font-weight: 600;
		font-size: 16px;
		line-height: 1.2;
		margin-bottom: 2px;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.meta .sub {
		font-size: 15px;
		opacity: 0.7;
		margin-bottom: 3px;
	}
	.meta .desc {
		font-size: 14px;
		line-height: 1.3;
		opacity: 0.85;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 80px;
	}
	.actions a {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 11px;
		color: #0a0a0a;
		text-align: center;
		text-decoration: underline;
		opacity: 0.7;
	}
	.actions a:hover {
		opacity: 1;
	}

	.empty-state {
		padding: 20px;
		text-align: center;
		opacity: 0.6;
	}

	.result-wrap {
		display: flex;
		flex-direction: column;
	}

	.expansion {
		border: 2px solid #0a0a0a;
		border-top: none;
		background: #faf7f0;
		padding: 10px;
	}
	.expansion.error {
		background: #d63030;
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
	}
	.expansion-header {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		margin-bottom: 8px;
	}
	.expansion-controls {
		display: flex;
		gap: 6px;
		margin-bottom: 10px;
		align-items: center;
	}
	.expansion-controls .grow {
		flex: 1;
	}
	.file-list {
		max-height: 50vh;
		overflow-y: auto;
		border: 1px solid #d9d4c4;
		background: #fff;
	}
	.season-group {
		border-bottom: 1px solid #d9d4c4;
	}
	.season-group:last-child {
		border-bottom: none;
	}
	.season-header {
		background: #0a0a0a;
		color: #fff;
		padding: 4px 10px;
		font-family: 'Press Start 2P', monospace;
		font-size: 9px;
		letter-spacing: 0.5px;
	}
	.file-row {
		display: grid;
		grid-template-columns: 24px 44px 1fr auto;
		gap: 8px;
		align-items: center;
		padding: 4px 10px;
		font-size: 14px;
		cursor: pointer;
		border-bottom: 1px solid #f0ede4;
	}
	.file-row:last-child {
		border-bottom: none;
	}
	.file-row:hover {
		background: #faf7f0;
	}
	.file-ep {
		font-family: 'Pixelify Sans', sans-serif;
		font-weight: 600;
		font-size: 12px;
		opacity: 0.7;
	}
	.file-title {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-dur {
		font-family: 'VT323', monospace;
		font-size: 13px;
		opacity: 0.6;
	}

	.cluster {
		border: 2px solid #0a0a0a;
		background: #fff7d6;
		box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35);
	}
	.cluster-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
	}
	.cluster-icon {
		font-size: 24px;
		line-height: 1;
	}
	.cluster-text {
		flex: 1;
		min-width: 0;
	}
	.cluster-title {
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		line-height: 1.3;
		margin-bottom: 4px;
	}
	.cluster-sub {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		opacity: 0.7;
	}
	.cluster-details {
		border-top: 2px solid #0a0a0a;
		padding: 6px 14px 10px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
	}
	.cluster-details summary {
		cursor: pointer;
		padding: 4px 0;
		opacity: 0.7;
	}
	.cluster-details summary:hover {
		opacity: 1;
	}
	.cluster-list {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		max-height: 240px;
		overflow-y: auto;
	}
	.cluster-list li {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: 12px;
		padding: 2px 0;
		font-size: 13px;
		border-bottom: 1px dashed #d9d4c4;
	}
	.cluster-list li:last-child {
		border-bottom: none;
	}
	.cluster-list code {
		font-size: 12px;
		background: transparent;
		border: none;
		padding: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		opacity: 0.6;
	}

	code {
		font-family: 'VT323', monospace;
		background: #faf7f0;
		padding: 1px 5px;
		border: 1px solid #ddd;
		font-size: 15px;
	}

	/* SAVE BANNER */
	.save-banner {
		margin-bottom: 12px;
	}
	.big-save {
		width: 100%;
		font-family: 'Press Start 2P', monospace;
		font-size: 11px;
		padding: 14px 12px;
		background: #a6f000;
		box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.35);
		letter-spacing: 0.5px;
	}
	.big-save:hover:not(:disabled) {
		background: #f9bd2b;
	}
	.save-banner.disabled .big-save {
		background: #faf7f0;
	}
	.save-hint {
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 11px;
		opacity: 0.6;
		margin-top: 4px;
		text-align: center;
	}
	.save-result {
		padding: 8px 12px;
		margin-bottom: 12px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		border: 2px solid #0a0a0a;
	}
	.save-result.ok {
		background: #a6f000;
	}
	.save-result.err {
		background: #d63030;
		color: #fff;
	}
	.flash {
		padding: 8px 12px;
		margin-bottom: 12px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 13px;
		background: #a6f000;
		border: 2px solid #0a0a0a;
		animation: flash-in 0.2s ease-out;
	}
	@keyframes flash-in {
		from {
			transform: translateY(-4px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	/* EPISODES */
	.episode-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 2px solid #0a0a0a;
		background: #faf7f0;
	}
	.episode-item {
		display: flex;
		gap: 8px;
		align-items: center;
		padding: 5px 8px;
		border-bottom: 1px solid #d9d4c4;
		font-size: 15px;
	}
	.episode-item:last-child {
		border-bottom: none;
	}
	.episode-item .ep-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.episode-item .ep-year {
		font-size: 13px;
		opacity: 0.6;
		font-family: 'Pixelify Sans', sans-serif;
	}
	.episode-empty {
		padding: 14px;
		font-size: 14px;
		opacity: 0.55;
		text-align: center;
	}

	.controls {
		display: flex;
		gap: 8px;
		margin-top: 12px;
		justify-content: flex-end;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.library-section {
		max-width: 1200px;
		margin: 16px auto 0;
		padding: 0 12px;
	}
	.library-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 6px;
	}
	.library-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border: 2px solid #0a0a0a;
		background: #faf7f0;
	}
	.lib-text {
		flex: 1;
		min-width: 0;
	}
	.lib-name {
		font-family: 'Pixelify Sans', sans-serif;
		font-weight: 600;
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lib-sub {
		font-size: 13px;
		opacity: 0.65;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lib-sub code {
		font-size: 12px;
		background: transparent;
		border: none;
		padding: 0;
	}
	.library-empty {
		padding: 14px;
		font-size: 14px;
		opacity: 0.55;
		text-align: center;
	}
	.lib-hint {
		margin-top: 10px;
		font-family: 'Pixelify Sans', sans-serif;
		font-size: 12px;
		opacity: 0.6;
		text-align: center;
	}
</style>

<script lang="ts">
	let { showCount = 0, botCount = 0 }: { showCount?: number; botCount?: number } = $props();
</script>

<div class="stats">
	<div class="row"><span>Shows online</span><span class="n">{showCount}</span></div>
	<div class="row"><span>Characters</span><span class="n">{botCount}</span></div>
	<div class="row"><span>Messages sent today</span><span class="n">14,209</span></div>
	<div class="row"><span>"That's what she said"s</span><span class="n">3,481</span></div>
	<div class="row"><span>Marriages (Ross)</span><span class="n">3</span></div>
	<div class="row"><span>Server uptime</span><span class="n">98.4%</span></div>
	<div class="row"><span>Cease-and-desist letters</span><span class="n">0*</span></div>
	<p class="footnote">* for now. love &amp; respect to NBCUniversal, etc.</p>
</div>

<style>
	.stats { padding: 14px; font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 10px; line-height: 1.5; display: grid; gap: 8px; }
	.row { display: flex; justify-content: space-between; border-bottom: 1px dotted var(--ink); padding-bottom: 6px; align-items: baseline; }
	.n { font-family: var(--brand-font-body, 'VT323', monospace); font-size: 22px; }
	.footnote { font-family: var(--brand-font-body, 'VT323', monospace); font-size: 16px; margin-top: 4px; opacity: 0.8; }
</style>

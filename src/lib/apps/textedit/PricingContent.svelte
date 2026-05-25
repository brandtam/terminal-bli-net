<div class="pricing">
	<h2>Pricing.txt</h2>
	<div class="tiers">
		<div class="tier">
			<div class="name"><span>BASIC</span><span class="price">$0</span></div>
			<ul>
				<li>20 messages / day</li>
				<li>Sitcoms only (Seinfeld, Office, Friends)</li>
				<li>Solo characters</li>
				<li>Watermark on shareable transcripts</li>
			</ul>
		</div>
		<div class="tier featured">
			<div class="name"><span>PRO</span><span class="price">$5/mo</span></div>
			<ul>
				<li>Unlimited messages</li>
				<li>Full roster (incl. Succession, prestige drama, anti-heroes)</li>
				<li>Group chats — up to 4 characters at once</li>
				<li>Custom scene prompts ("you're stuck in an elevator")</li>
				<li>Export to .txt with a CRT scanline filter</li>
			</ul>
		</div>
		<div class="tier">
			<div class="name"><span>SHOWRUNNER</span><span class="price">$29/mo</span></div>
			<ul>
				<li>Everything in Pro</li>
				<li>Upload your own bible (PDF / fan wiki) → make your own cast</li>
				<li>API access · 100k tokens/day</li>
				<li>Priority during Emmy season</li>
			</ul>
		</div>
	</div>
	<p class="footnote">
		Cancel any time. Pricing in fake dollars. Real dollars also fine.
	</p>
</div>

<style>
	.pricing { padding: 14px; font-family: var(--brand-font-body, 'VT323', monospace); font-size: 18px; }
	h2 { font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 12px; margin: 0 0 12px; font-weight: normal; }
	.tiers { display: grid; gap: 10px; }
	.tier { border: 2px solid var(--ink); padding: 10px 12px; background: var(--paper); }
	.tier.featured { background: var(--accent-2); }
	.name { font-family: var(--brand-font-display, 'Press Start 2P', monospace); font-size: 11px; display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
	.price { font-size: 14px; }
	ul { list-style: none; padding: 0; margin: 6px 0 0; font-size: 17px; line-height: 1.3; }
	li::before { content: '▸ '; }
	.footnote { margin-top: 12px; font-size: 16px; opacity: 0.75; }
</style>

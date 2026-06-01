<script lang="ts">
	let {
		scale = 1,
		tilt = 0,
		x = 380,
		y = 56
	}: {
		scale?: number;
		tilt?: number;
		x?: number;
		y?: number;
	} = $props();

	const W = 160;
	const H = 216;
</script>

<div
	class="counter-scene"
	style:left="{x}px"
	style:top="{y}px"
	style:width="{W * scale}px"
	style:height="{H * scale}px"
	style:transform={tilt ? `perspective(1600px) rotateY(${tilt}deg)` : undefined}
>
	<svg
		viewBox="0 0 {W} {H}"
		width="100%"
		height="100%"
		shape-rendering="crispEdges"
		style="overflow: visible"
	>
		<!-- CLERK — animated shuffle behind counter -->
		<g>
			<animateTransform
				attributeName="transform"
				type="translate"
				calcMode="discrete"
				values="32,68;40,67;48,68;56,67;64,68;72,67;80,68;88,67;96,68;88,67;80,68;72,67;64,68;56,67;48,68;40,67"
				dur="10s"
				repeatCount="indefinite"
			/>
			<!-- hair -->
			<rect x="2" y="0" width="14" height="2" fill="#5a3a18" />
			<rect x="0" y="2" width="18" height="3" fill="#5a3a18" />
			<!-- face -->
			<rect x="2" y="5" width="14" height="10" fill="#f0c89a" />
			<rect x="0" y="5" width="2" height="6" fill="#5a3a18" />
			<rect x="16" y="5" width="2" height="6" fill="#5a3a18" />
			<!-- eyes -->
			<rect x="4" y="8" width="3" height="2" fill="#ffffff" />
			<rect x="11" y="8" width="3" height="2" fill="#ffffff" />
			<rect x="5" y="8" width="2" height="2" fill="#0a0a0a" />
			<rect x="12" y="8" width="2" height="2" fill="#0a0a0a" />
			<!-- smile -->
			<rect x="6" y="12" width="6" height="1" fill="#a04030" />
			<!-- neck -->
			<rect x="6" y="15" width="6" height="2" fill="#e0b888" />
			<!-- shoulders -->
			<rect x="-4" y="17" width="26" height="4" fill="#5e3a8a" />
			<!-- vest body -->
			<rect x="-2" y="21" width="22" height="44" fill="#5e3a8a" />
			<!-- arms + hands -->
			<rect
				x="-4"
				y="21"
				width="3"
				height="18"
				fill="#5e3a8a"
				stroke="#0a0a0a"
				stroke-width="0.5"
			/>
			<rect x="-4" y="38" width="3" height="4" fill="#f0c89a" stroke="#0a0a0a" stroke-width="0.5" />
			<rect
				x="19"
				y="21"
				width="3"
				height="18"
				fill="#5e3a8a"
				stroke="#0a0a0a"
				stroke-width="0.5"
			/>
			<rect x="19" y="38" width="3" height="4" fill="#f0c89a" stroke="#0a0a0a" stroke-width="0.5" />
			<!-- collar -->
			<rect x="4" y="17" width="2" height="4" fill="#ffffff" />
			<rect x="12" y="17" width="2" height="4" fill="#ffffff" />
			<!-- tie -->
			<rect x="8" y="17" width="2" height="12" fill="#f9bd2b" />
			<rect x="7" y="24" width="4" height="6" fill="#f9bd2b" />
			<!-- name badge -->
			<rect x="1" y="26" width="6" height="3" fill="#ffffff" stroke="#0a0a0a" stroke-width="0.5" />
			<rect x="2" y="27" width="4" height="1" fill="#0a0a0a" />
		</g>

		<!-- REGISTER -->
		<rect x="28" y="102" width="38" height="22" fill="#dcd6c8" stroke="#0a0a0a" stroke-width="2" />
		<rect x="32" y="105" width="30" height="7" fill="#a6f000" stroke="#0a0a0a" stroke-width="1" />
		{#each [0, 1, 2] as c (c)}
			{#each [0, 1] as r (r)}
				<rect x={34 + c * 9} y={114 + r * 4} width="6" height="2" fill="#0a0a0a" />
			{/each}
		{/each}
		<!-- receipt printer / scanner -->
		<rect x="84" y="108" width="22" height="16" fill="#3a322a" stroke="#0a0a0a" stroke-width="2" />
		<rect x="88" y="111" width="14" height="4" fill="#1ec8ff" />

		<!-- COUNTER TOP -->
		<rect x="0" y="124" width="156" height="40" fill="#a06a3a" stroke="#0a0a0a" stroke-width="2" />
		{#each [20, 50, 90, 130] as lx (lx)}
			<line x1={lx} y1="124" x2={lx} y2="164" stroke="#7a4f2a" stroke-width="1" />
		{/each}

		<!-- COUNTER BASE -->
		<rect x="0" y="164" width="156" height="50" fill="#7a4f2a" stroke="#0a0a0a" stroke-width="2" />

		<!-- CHECKOUT placard -->
		<rect x="28" y="135" width="100" height="22" fill="#0a0a0a" stroke="#0a0a0a" stroke-width="2" />
		<rect x="30" y="137" width="96" height="2" fill="rgba(255,255,255,0.15)" />
		<text
			x="78"
			y="152"
			font-family="'Press Start 2P', monospace"
			font-size="10"
			fill="#f9bd2b"
			text-anchor="middle"
			letter-spacing="1">CHECKOUT</text
		>

		<!-- NO RETURNS sign -->
		<rect x="15" y="170" width="80" height="14" fill="#ffffff" stroke="#0a0a0a" stroke-width="1" />
		<text
			x="55"
			y="181"
			font-family="'Press Start 2P', monospace"
			font-size="7"
			fill="#0a0a0a"
			text-anchor="middle">NO RETURNS</text
		>
	</svg>
</div>

<style>
	.counter-scene {
		position: absolute;
		z-index: 4;
		transform-origin: 50% 50%;
	}
</style>

/**
 * dsh-model-reasoning-defaults
 *
 * pi-ai only offers a thinking-strength selector for a model that declares
 * `reasoningEfforts`. Models imported from a gateway (or typed into the Models
 * page by id alone) carry no such declaration, so the picker has nothing to
 * show. This profile-local plugin fills that declaration with a default set
 * as soon as such a model appears in the `llm-pi-ai` settings namespace, and
 * after every later save of that namespace.
 *
 * It never overrides a declaration the user already made — including
 * `reasoningEfforts: false`, which marks a non-reasoning model on purpose.
 * It only touches providers that carry an explicit `models` array; catalog
 * routes without one keep pi-ai's installed capabilities untouched.
 *
 * Disable by removing the `model-reasoning-defaults` insert entry from
 * `cordis.patch.yml`, or set `enabled: false` in its config.
 */

/** @typedef {{ efforts?: Record<string, string | null>, skipProviders?: string[], enabled?: boolean }} Options */

export const name = "dsh-model-reasoning-defaults";

export const inject = ["settings"];

/** Settings namespace that owns the gateway profiles. */
const NS = "llm-pi-ai";

/** Levels offered when a model says nothing. Wire value equals the level. */
const DEFAULT_EFFORTS = {
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max",
};

/**
 * Add the default declaration to every model that has none.
 * @param providers - the `providers` value from the llm-pi-ai settings form.
 * @param efforts - levels to declare.
 * @param skip - provider ids to leave alone.
 * @returns the next providers value and whether anything changed.
 */
export function plan(providers, efforts, skip = []) {
	const skipped = new Set(skip);
	const next = {};
	let changed = false;
	for (const [id, profile] of Object.entries(providers ?? {})) {
		if (skipped.has(id) || profile === null || typeof profile !== "object" || Array.isArray(profile)) {
			next[id] = profile;
			continue;
		}
		const models = profile.models;
		if (!Array.isArray(models)) {
			next[id] = profile;
			continue;
		}
		let touched = false;
		const mapped = models.map((model) => {
			if (model === null || typeof model !== "object" || Array.isArray(model)) return model;
			if (typeof model.id !== "string" || model.id.length === 0) return model;
			// `false` is an explicit "this model does not reason"; an object is a
			// hand-written mapping. Both are the user's decision, not a gap.
			if (Object.hasOwn(model, "reasoningEfforts")) return model;
			touched = true;
			return { ...model, reasoningEfforts: { ...efforts } };
		});
		if (touched) {
			changed = true;
			next[id] = { ...profile, models: mapped };
		} else {
			next[id] = profile;
		}
	}
	return { changed, providers: next };
}

/**
 * @param ctx - Cordis context carrying the settings service.
 * @param options - plugin config from `cordis.patch.yml`.
 */
export function apply(ctx, options = {}) {
	if (options.enabled === false) return;
	const efforts = { ...DEFAULT_EFFORTS, ...(options.efforts ?? {}) };
	const skipProviders = Array.isArray(options.skipProviders) ? options.skipProviders : [];

	let timer;
	let running = false;
	let queued = false;
	let quietUntil = 0;

	const schedule = (delay) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			// The plugin is mounted inside the HMR transaction that loads the
			// profile, and AsyncLocalStorage carries that context into this timer.
			// Leaving it lets configEditor.edit() open its own transaction.
			const hmr = ctx.get("hmr");
			const go = () => {
				void run();
			};
			if (typeof hmr?.executing?.exit === "function") hmr.executing.exit(go);
			else go();
		}, delay);
	};

	async function run() {
		if (Date.now() < quietUntil) return;
		if (running) {
			queued = true;
			return;
		}
		running = true;
		try {
			const descriptor = ctx.settings.describe().find((row) => row.ns === NS);
			if (descriptor === undefined) return;
			// The user layer carries only what was written to this profile; the
			// resolved value would materialize schema defaults and rewrite fields
			// the user never set (input, compat, capacities…).
			const current = (descriptor.user ?? descriptor.value)?.providers;
			const { changed, providers } = plan(current, efforts, skipProviders);
			if (!changed) return;
			quietUntil = Date.now() + 4000;
			await ctx.settings.update(NS, { providers }, descriptor.revision);
			ctx.logger.info("[model-reasoning-defaults] added default reasoning efforts to new models");
		} catch (error) {
			ctx.logger.warn("[model-reasoning-defaults] could not add default reasoning efforts");
			ctx.logger.warn(error);
		} finally {
			running = false;
			if (queued) {
				queued = false;
				schedule(1500);
			}
		}
	}

	ctx.on("app-boot/config-reload", () => schedule(2000));
	ctx.on("settings/document-updated", (ns) => {
		if (ns === NS) schedule(1500);
	});

	// The first pass runs after the boot settles; later passes follow saves.
	schedule(5000);
}

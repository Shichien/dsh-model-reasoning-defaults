import assert from "node:assert/strict";
import test from "node:test";

import { plan } from "../lib/index.js";

const EFFORTS = { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" };

test("fills only models that declare no reasoning effort", () => {
	const providers = {
		gateway: {
			models: [{ id: "a" }, { id: "b", reasoningEfforts: { low: "low", medium: "high" } }],
		},
	};
	const { changed, providers: next } = plan(providers, EFFORTS);
	assert.equal(changed, true);
	assert.deepEqual(next.gateway.models[0].reasoningEfforts, EFFORTS);
	assert.deepEqual(next.gateway.models[1].reasoningEfforts, { low: "low", medium: "high" });
});

test("never overrides an explicit non-reasoning model", () => {
	const providers = { gateway: { models: [{ id: "tts", reasoningEfforts: false }] } };
	const { changed, providers: next } = plan(providers, EFFORTS);
	assert.equal(changed, false);
	assert.equal(next.gateway.models[0].reasoningEfforts, false);
});

test("leaves catalog-only providers without a models array alone", () => {
	const providers = { anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" } };
	const { changed, providers: next } = plan(providers, EFFORTS);
	assert.equal(changed, false);
	assert.deepEqual(next.anthropic, { apiKeyEnv: "ANTHROPIC_API_KEY" });
});

test("honours skipProviders", () => {
	const providers = { gateway: { models: [{ id: "a" }] } };
	const { changed } = plan(providers, EFFORTS, ["gateway"]);
	assert.equal(changed, false);
});

test("ignores malformed rows and rows without an id", () => {
	const providers = {
		gateway: { models: [null, "nope", { id: "" }, { name: "no-id" }, { id: "ok" }] },
	};
	const { changed, providers: next } = plan(providers, EFFORTS);
	assert.equal(changed, true);
	assert.equal(next.gateway.models.length, 5);
	assert.deepEqual(next.gateway.models[4].reasoningEfforts, EFFORTS);
	assert.equal(next.gateway.models[0], null);
});

test("reports no change for an empty or absent provider map", () => {
	assert.equal(plan(undefined, EFFORTS).changed, false);
	assert.equal(plan({}, EFFORTS).changed, false);
});

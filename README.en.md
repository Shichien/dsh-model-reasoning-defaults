# dsh-model-reasoning-defaults

English | [中文](README.md)

A DeepSeek Harness plugin that gives **newly imported pi-ai models** a default set of reasoning-effort levels, so the thinking-strength picker is never empty.

## Why

DSH only shows reasoning-effort choices a model declares through `reasoningEfforts`. Models imported from a gateway (or typed into the Models page by id alone) usually carry no such declaration, so the adapter reports zero levels and the picker has nothing to show.

On every save of the `llm-pi-ai` settings namespace the plugin inspects the model directory. Models **without** `reasoningEfforts` get `low / medium / high / xhigh / max`, written back to the profile's `cordis.patch.yml` through DSH's settings service (revision-checked; a rejected write rolls back as a whole).

## Behaviour

- Fills **missing** declarations only. Existing maps — including custom wire values such as `medium: high` — are left untouched.
- `reasoningEfforts: false` means "this model does not reason"; it is never rewritten.
- Only providers with an explicit `models` array are touched. Catalog routes without one keep pi-ai's installed capabilities.
- Runs once 5 seconds after boot (to let the profile settle), then after each save of the `llm-pi-ai` namespace.
- Converges: once nothing is missing, a pass changes nothing.

## Install

### CLI-managed profile

```bash
git clone https://github.com/Shichien/dsh-model-reasoning-defaults
dsh plugin --profile <profile> add link:/path/to/dsh-model-reasoning-defaults
```

The bundled [`cordis.patch.yml`](cordis.patch.yml) registers the plugin entry.

### DSH Desktop's desktop profile

The desktop profile is managed by Electron and rejects `dsh plugin`. Install manually:

1. Put this package at `~/Library/Application Support/dsh-desktop/harness/profiles/desktop/node_modules/dsh-model-reasoning-defaults`
2. Append to that profile's `cordis.patch.yml`:

   ```yaml
   - insert:
       - id: model-reasoning-defaults
         name: dsh-model-reasoning-defaults
         config:
           efforts:
             low: low
             medium: medium
             high: high
             xhigh: xhigh
             max: max
   ```

3. Restart DSH Desktop (external profile edits are not hot-reloaded).

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | `false` disables the plugin entirely |
| `efforts` | `low / medium / high / xhigh / max` | Levels to declare; each value is the wire spelling sent for that level |
| `skipProviders` | `[]` | Provider ids to leave alone |

## Caveats

- Levels are sent **verbatim**. If an upstream only accepts some of them (GLM / Kimi accept `low / high / max`), selecting an unsupported value fails the request. Adjust that level's wire value on the Models page, or mark the model `reasoningEfforts: false`.
- Only hand-declared / gateway routes are handled; account-backed catalogs such as `llm-deepseek-account` are not.
- The plugin edits the profile's `cordis.patch.yml` (user layer), so every change stays visible and removable.

## Development

```bash
npm test
```

`lib/index.js` exports the plugin entry plus a pure `plan()` function, so the tests run without booting Harness.

## License

MIT

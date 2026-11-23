# dsh-model-reasoning-defaults

[English](README.en.md) | 中文

给 DeepSeek Harness 里**新导入的 pi-ai 模型**自动补上思考强度档位，让模型选择器永远有档可选。

## 解决的问题

DSH 的思考强度选择器只显示模型自己声明的 `reasoningEfforts`。从网关导入的模型（或在设置页只填了 id / name 的模型）通常没有这个声明，适配器就报不出任何档位，选择器里自然一档都没有。

这个插件在 `llm-pi-ai` 设置每次保存后检查一遍模型目录：凡是**没有** `reasoningEfforts` 的模型，自动补上 `low / medium / high / xhigh / max` 五档，并写回 profile 的 `cordis.patch.yml`。写回走 DSH 的 settings 服务，带 revision 校验，配置不合法时会整笔回滚。

## 行为

- 只补**缺失**的声明；已有的 `reasoningEfforts`（包括自定义线上值，例如 `medium: high`）原样保留。
- `reasoningEfforts: false` 视为“这个模型不推理”，不会被改写。
- 只处理带显式 `models` 数组的 provider；没有 `models` 的目录型路由不碰，保留 pi-ai 自带的能力。
- 启动后延迟 5 秒跑第一次（等 profile 装载完成），之后跟随 `llm-pi-ai` 的设置保存触发的检查。
- 检查收敛：补完之后再检查发现无缺失就停止，不会反复改文件。

## 安装

### CLI 管理的 profile

```bash
git clone https://github.com/Shichien/dsh-model-reasoning-defaults
dsh plugin --profile <profile> add link:/path/to/dsh-model-reasoning-defaults
```

包里的 [`cordis.patch.yml`](cordis.patch.yml) 是 bundle patch，会注册插件条目。

### DSH Desktop 的 desktop profile

desktop profile 由 Electron 管理，`dsh plugin` 不接受它。手动安装：

1. 把本包目录放进 `~/Library/Application Support/dsh-desktop/harness/profiles/desktop/node_modules/dsh-model-reasoning-defaults`
2. 在该 profile 的 `cordis.patch.yml` 末尾追加：

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

3. 重启 DSH Desktop（外部修改 profile 配置不会热加载）。

## 配置

插件条目的 `config` 支持：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `enabled` | `true` | `false` 时完全不动作，等价于禁用插件 |
| `efforts` | `low / medium / high / xhigh / max` | 补写进模型的档位表；值是该档位在协议里发送的线上拼写 |
| `skipProviders` | `[]` | 不处理的 provider id 列表 |

想改默认档位，直接改 `efforts`；例如只想要三档：

```yaml
config:
  efforts:
    low: low
    medium: medium
    high: high
```

## 注意

- 档位值会**按同名原样发送**。上游只认部分档位时（例如 GLM / Kimi 只接受 `low / high / max`），选中它不认的值会请求失败。遇到这种情况，在设置页把那一档的“API 参数值”改成它接受的值，或把该模型设为 `reasoningEfforts: false`。
- 插件只补网关/手工声明这条路径；`llm-deepseek-account` 等账号型模型目录不归它管。
- 插件改的是 profile 的 `cordis.patch.yml`，属于用户层配置，随时可以手改或删掉。

## 开发

```bash
npm test
```

`lib/index.js` 只导出插件入口和纯函数 `plan()`，测试不需要启动 Harness。

## License

MIT

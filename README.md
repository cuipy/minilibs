# minilibs

小游戏多平台适配通用库：把微信、抖音两家的接口收成同一套名字，并补齐各家缺的能力，让同一个游戏工程能在两个平台之间一键切换。

## 目录结构

```
minilibs/
├── common.js            # 平台公共封装（复制为游戏端的 game/platform-common.js）
├── weixin/              # 微信端平台实现（platform.js）
├── douyin/              # 抖音端平台实现（platform.js）
├── templates/           # 两家平台的 game.json / project.config.json 模板
└── prepackage.js        # 打包前切换平台的脚本
```

## 用法

在放配置 json 的游戏仓库里执行（也可写绝对路径）：

```
node <minilibs>/prepackage.js platform.json -weixin   切成微信版
node <minilibs>/prepackage.js platform.json -douyin   切成抖音版
node <minilibs>/prepackage.js platform.json           只看当前状态，不改文件
node <minilibs>/prepackage.js platform.json --check   只读自检，不改文件
```

配置 json 参考 `config.example.json`，放在游戏仓库里，路径按「配置文件所在目录」解析，换电脑不用改。

## 脚本行为说明

- 只写 5 个文件，其余一律不碰：
  - `game/platform.js`、`game/platform-common.js`、`game/platform-config.js`
  - `game.json`、`project.config.json`
- 跑一次和跑两次结果相同（幂等）；`--check` 可静态校验生成物与模板一致、上层用到的平台方法在实现里都存在。
- 屏幕方向支持 `portrait` / `landscape`，也接受拼音 `shuping` / `hengping`，打包时自动翻译。
- 微信有、抖音缺的接口（如窗口尺寸、设备信息、性能档位）会做补齐与归一化，上层不必判空；桌面端平台标识统一映射成 `windows`。

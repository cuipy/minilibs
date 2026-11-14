// 小游戏平台公共封装：把微信、抖音两家的接口收成同一套名字，并补齐各家缺的能力。
// 本文件由 prepackage.js 复制为 game/platform-common.js，随小游戏包一起发布。
// 只依赖宿主全局对象，不引用任何 Node 模块，也不引用工程外的文件。

// 直接转调、两家同名同参数的接口（事件注册与存储类）
const DIRECT = [
  'getStorageSync',
  'setStorageSync',
  'onWindowResize',
  'onTouchStart',
  'onTouchMove',
  'onTouchEnd',
  'onTouchCancel',
  'onKeyDown',
  'onKeyUp',
];

// 创建对象、返回实例的接口：缺失时直接报清楚，别让上层拿到 undefined 再莫名崩
const CREATORS = [
  'createCanvas',
  'getFileSystemManager',
  'createImage',
  'createInnerAudioContext',
];

// 桌面端平台取值各家不一，统一映射成上层认识的 'windows'
const DESKTOP_PLATFORMS = ['windows', 'mac', 'devtools', 'pc', 'win'];

function noop() {}

function makePlatform(host, cfg) {
  const api = { name: cfg.platformName };

  for (const name of DIRECT) {
    api[name] = typeof host[name] === 'function'
      ? function () { return host[name].apply(host, arguments); }
      : noop;
  }

  for (const name of CREATORS) {
    api[name] = typeof host[name] === 'function'
      ? function () { return host[name].apply(host, arguments); }
      : function () { throw new Error('[platform] 当前环境缺少接口 ' + name); };
  }

  // 系统信息：微信有 benchmarkLevel，抖音若不返回就用配置里的默认档。
  // 不补的话上层会按最低档跑（蛇数 60、AI 射线 16、像素比上限 2），画面与微信端不一致。
  api.getSystemInfoSync = function () {
    const info = typeof host.getSystemInfoSync === 'function'
      ? Object.assign({}, host.getSystemInfoSync())
      : {};
    if (info.benchmarkLevel == null) info.benchmarkLevel = cfg.defaultBenchmarkLevel;
    return info;
  };

  // 窗口信息：抖音可能没有 getWindowInfo，用系统信息里的宽高顶上
  api.getWindowInfo = function () {
    if (typeof host.getWindowInfo === 'function') return host.getWindowInfo();
    return api.getSystemInfoSync();
  };

  // 设备信息：抖音可能没有 getDeviceInfo；顺手把桌面端标识归一化，
  // 让上层「是不是 PC」的判断在两家都成立。
  api.getDeviceInfo = function () {
    const info = typeof host.getDeviceInfo === 'function'
      ? Object.assign({}, host.getDeviceInfo())
      : api.getSystemInfoSync();
    if (info && typeof info.platform === 'string'
      && DESKTOP_PLATFORMS.indexOf(info.platform.toLowerCase()) >= 0) {
      info.platform = 'windows';
    }
    return info;
  };

  // 微信有、抖音不支持：给个什么都不做的实现，上层不必判空
  api.onWindowStateChange = function (cb) {
    if (typeof host.onWindowStateChange === 'function') host.onWindowStateChange(cb);
  };

  return api;
}

module.exports = { makePlatform };

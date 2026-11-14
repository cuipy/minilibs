// 微信小游戏实现：由 prepackage.js 复制为 game/platform.js。
// 这一层是唯一知道「当前跑在微信」的地方，上层游戏代码不关心平台。
const { makePlatform } = require('./platform-common.js');
const cfg = require('./platform-config.js');

if (typeof wx === 'undefined') {
  throw new Error('[platform] 当前是微信版实现，但没找到微信运行环境；请先执行 prepackage.js <配置.json> -douyin 切换平台，或 -weixin 切回来');
}

module.exports = makePlatform(wx, cfg);

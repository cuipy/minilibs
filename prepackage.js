#!/usr/bin/env node
// 小游戏打包前准备：把一个游戏的小游戏端切换成「微信版」或「抖音版」。
//
// 用法（在放配置 json 的那个仓库里执行，也可写绝对路径）：
//   node <minilibs>/prepackage.js platform.json -weixin   切成微信版
//   node <minilibs>/prepackage.js platform.json -douyin   切成抖音版
//   node <minilibs>/prepackage.js platform.json            只看当前状态，不改文件
//   node <minilibs>/prepackage.js platform.json --check    只读自检，不改文件
//
// 说明：
// - 本脚本只写下面 5 个文件，其余一律不碰（尤其不动 server/、game/shared/、资源与版本号）。
// - 配置 json 放在游戏仓库；里面的路径按「配置文件所在目录」解析，换电脑不用改。
// - require 的路径必须是静态的，所以生成物用固定文件名，由本脚本覆盖内容，不拼变量。
// - 跑一次和跑两次结果相同。

const fs = require('node:fs');
const path = require('node:path');

const LIBS_DIR = __dirname;
const PLATFORMS = ['weixin', 'douyin'];
const DEFAULT_BENCH = 30;

function fail(msg) {
  console.error('[prepackage] ' + msg);
  process.exit(1);
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function usage() {
  console.log('用法: node prepackage.js <配置.json> [-weixin|-douyin|--check]');
  console.log('  不带平台参数：只打印当前状态；--check：只读自检。');
}

// ——— 参数 ———
const argv = process.argv.slice(2);
let cfgArg = null;
let mode = null; // weixin / douyin / check / status
for (const a of argv) {
  if (a === '--check') {
    mode = 'check';
  } else if (a === '-weixin' || a === '-douyin') {
    if (mode === 'check') fail('--check 不能和平台参数一起用');
    mode = a.slice(1);
  } else if (a.charAt(0) === '-') {
    fail('不认识的参数：' + a);
  } else if (!cfgArg) {
    cfgArg = a;
  } else {
    fail('只能给一个配置文件');
  }
}
if (!cfgArg) {
  usage();
  fail('缺少配置 json');
}
if (!mode) mode = 'status';

// ——— 配置 ———
const cfgAbs = path.resolve(process.cwd(), cfgArg);
if (!fs.existsSync(cfgAbs)) fail('找不到配置文件：' + cfgAbs);
let cfg;
try {
  cfg = JSON.parse(readText(cfgAbs));
} catch (e) {
  fail('配置 json 解析失败：' + e.message);
}
if (!cfg || typeof cfg !== 'object' || !cfg.platforms) fail('配置里缺少 platforms');

const gameDir = path.resolve(path.dirname(cfgAbs), cfg.gameDir || '.');
if (!fs.existsSync(path.join(gameDir, 'game.js'))) {
  fail('小游戏工程目录不对（没找到 game.js）：' + gameDir);
}

const bench = Number(cfg.defaultBenchmarkLevel != null ? cfg.defaultBenchmarkLevel : DEFAULT_BENCH);
for (const name of PLATFORMS) {
  if (!cfg.platforms[name]) fail('配置里缺少 platforms.' + name);
}

// ——— 生成物的目标路径（白名单） ———
const targets = {
  impl: path.join(gameDir, 'game', 'platform.js'),
  common: path.join(gameDir, 'game', 'platform-common.js'),
  runtimeConfig: path.join(gameDir, 'game', 'platform-config.js'),
  gameJson: path.join(gameDir, 'game.json'),
  projectJson: path.join(gameDir, 'project.config.json'),
};

function templatePath(name, file) {
  return path.join(LIBS_DIR, 'templates', name, file);
}

function readTemplate(name, file) {
  const f = templatePath(name, file);
  if (!fs.existsSync(f)) fail('缺少模板：' + f);
  return readText(f);
}

function runtimeConfigText(name) {
  return '// 由 prepackage.js 生成，请勿手改。当前平台：' + name + '\n'
    + 'module.exports = {\n'
    + '  platformName: ' + JSON.stringify(name) + ',\n'
    + '  defaultBenchmarkLevel: ' + bench + ',\n'
    + '};\n';
}

function projectConfigText(name) {
  const tpl = JSON.parse(readTemplate(name, 'project.config.json'));
  const p = cfg.platforms[name];
  tpl.appid = p.appid || '';
  tpl.projectname = p.projectname || '';
  return JSON.stringify(tpl, null, 2) + '\n';
}

// 屏幕方向只影响开发者工具与真机的显示方向，不参与游戏逻辑。
// 不配置就是竖屏；某个平台单独写了就覆盖全局值。
const ORIENTATIONS = ['portrait', 'landscape'];
// 允许在配置里用拼音填写屏幕方向（记不住英文时），打包时自动翻成英文。
const ORIENT_PINYIN = { shuping: 'portrait', hengping: 'landscape' };
function normalizeOrientation(v) {
  if (v == null) return v;
  return ORIENT_PINYIN[String(v).toLowerCase()] || v;
}

function orientationOf(name) {
  const p = cfg.platforms[name] || {};
  const value = normalizeOrientation(p.deviceOrientation || cfg.deviceOrientation || 'portrait');
  if (ORIENTATIONS.indexOf(value) < 0) {
    fail('deviceOrientation 只能是 portrait 或 landscape，当前是：' + value + '（平台：' + name + '）');
  }
  return value;
}

function gameJsonText(name) {
  const tpl = JSON.parse(readTemplate(name, 'game.json'));
  tpl.deviceOrientation = orientationOf(name);
  return JSON.stringify(tpl, null, 2) + '\n';
}

function expectedFiles(name) {
  return {
    impl: readText(path.join(LIBS_DIR, name, 'platform.js')),
    common: readText(path.join(LIBS_DIR, 'common.js')),
    runtimeConfig: runtimeConfigText(name),
    gameJson: gameJsonText(name),
    projectJson: projectConfigText(name),
  };
}

function currentPlatform() {
  const f = targets.runtimeConfig;
  if (!fs.existsSync(f)) return null;
  const m = /platformName:\s*["']([^"']+)["']/.exec(readText(f));
  return m ? m[1] : null;
}

function sameAs(file, content) {
  return fs.existsSync(file) && readText(file) === content;
}

// 两个 json 配置只比语义，不比缩进和结尾换行，免得手写过的文件被误判成不一致
function sameJsonAs(file, content) {
  if (!fs.existsSync(file)) return false;
  try {
    return JSON.stringify(JSON.parse(readText(file))) === JSON.stringify(JSON.parse(content));
  } catch (e) {
    return false;
  }
}

// ——— 只读自检 ———
function check() {
  const name = currentPlatform();
  if (!name || PLATFORMS.indexOf(name) < 0) {
    fail('读不到当前平台，先跑一次 -weixin 或 -douyin 生成');
  }
  const expected = expectedFiles(name);
  const labels = {
    impl: '平台实现 game/platform.js',
    common: '公共封装 game/platform-common.js',
    runtimeConfig: '运行参数 game/platform-config.js',
    gameJson: '小游戏配置 game.json',
    projectJson: '工程配置 project.config.json',
  };
  let bad = 0;
  for (const key of Object.keys(expected)) {
    const ok = (key === 'gameJson' || key === 'projectJson')
      ? sameJsonAs(targets[key], expected[key])
      : sameAs(targets[key], expected[key]);
    if (!ok) bad++;
    console.log((ok ? '[一致] ' : '[不一致] ') + labels[key]);
  }

  // 上层用到的每个 platform.xxx，实现里都得有（粗略静态扫描，不执行游戏代码）
  const used = new Set();
  const gameFolder = path.join(gameDir, 'game');
  const files = [path.join(gameDir, 'game.js')];
  for (const f of fs.readdirSync(gameFolder)) {
    if (f.endsWith('.js') && !/^platform(-common|-config)?\.js$/.test(f)) {
      files.push(path.join(gameFolder, f));
    }
  }
  for (const f of files) {
    const text = readText(f);
    const re = /\bplatform\.([A-Za-z_]\w*)/g;
    let m;
    while ((m = re.exec(text))) used.add(m[1]);
  }
  const implText = expected.impl + '\n' + expected.common;
  const missing = Array.from(used).filter((n) => implText.indexOf(n) < 0);
  if (missing.length) {
    bad++;
    console.log('[缺接口] 上层调用了实现里没有的方法：' + missing.join(', '));
  } else {
    console.log('[一致] 上层 ' + used.size + ' 个平台方法都能在实现里找到');
  }

  const p = cfg.platforms[name];
  if (!p.appid) console.log('[提醒] ' + name + ' 的 appid 还没填，上传前请补到配置 json 里');
  console.log('当前平台：' + name + (bad ? '；有 ' + bad + " 项不一致，请重跑 -" + name : '；全部一致'));
  if (bad) process.exit(1);
}

// ——— 只看状态 ———
function status() {
  const name = currentPlatform();
  console.log('当前平台：' + (name || '未生成（请先跑一次 -weixin）'));
  console.log('配置文件：' + cfgAbs);
  console.log('小游戏工程：' + gameDir);
  for (const n of PLATFORMS) {
    const p = cfg.platforms[n];
    console.log('  ' + n + ' appid：' + (p.appid || '（未填）'));
  }
  usage();
}

// ——— 生成 ———
function generate(name) {
  const expected = expectedFiles(name);
  for (const key of Object.keys(expected)) {
    fs.writeFileSync(targets[key], expected[key], 'utf8');
  }
  const p = cfg.platforms[name];
  console.log('[prepackage] 已切换为 ' + name + ' 版，写入 5 个文件：');
  console.log('  game/platform.js、game/platform-common.js、game/platform-config.js');
  console.log('  game.json、project.config.json');
  if (!p.appid) console.log('[提醒] ' + name + ' 的 appid 还没填，上传前请补到配置 json 里再跑一次');
  console.log('[prepackage] 接下来请打开' + (name === 'weixin' ? '微信' : '抖音') + '开发者工具重新编译；换过 appid 时可能需要重新导入项目。');
}

if (mode === 'check') check();
else if (mode === 'status') status();
else generate(mode);

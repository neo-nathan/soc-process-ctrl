/**
 * 环境参数：地址写死（不是机密），口令只从环境变量读，缺了直接报错。
 * 口令由主 Agent 运行时从 CLAUDE.local.md 导出，本仓库任何文件都不写真实值。
 *   PL05_C_SSH      14.15 root 的 SSH 口令
 *   PL05_C_MYSQL    14.15 MySQL root 口令
 *   PL05_C_REDIS    14.15 Redis 口令
 *   PL05_T18_SSH    13.18 root 的 SSH 口令
 *   PL05_T220_SSH   13.220 root 的 SSH 口令
 */
'use strict';

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error('缺环境变量 ' + name + '（见 e2e/README.md）');
  return v;
}

module.exports = {
  baseURL: process.env.PL05_BASE_URL || 'https://193.168.14.15:10443',
  cdpURL: process.env.PL05_CDP_URL || 'http://127.0.0.1:9333', // 常驻浏览器的调试端口
  center: { host: '193.168.14.15', db: 'RS_ESM_LOG' },
  eid: 'A1E8178084463805',
  procmGuid: '2DA19BD4-5E8D-4397-B233-D9F95CD29DB3',
  t18: { host: '193.168.13.18', sguid: '475C1D126323B3E79B980CFF93E09AF9' },
  t220: { host: '193.168.13.220', sguid: '78430109337043509D862FE36885AD79' },
  // 同事的数据：只读，断言「不变」
  colleague: { pids: [3, 22, 25, 26], groups: [1, 3, 58659703] },
  names: {
    group: 'PL05测试组',
    policy: 'PL05测试-进程策略',
    white: 'PL05测试-白',
    white2: 'PL05测试-白2',
    black: 'PL05测试-黑',
  },
  secret: {
    centerSsh: () => need('PL05_C_SSH'),
    mysql: () => need('PL05_C_MYSQL'),
    redis: () => need('PL05_C_REDIS'),
    t18Ssh: () => need('PL05_T18_SSH'),
    t220Ssh: () => need('PL05_T220_SSH'),
  },
  // 所有口令值，证据落盘前用来过滤
  allSecrets() {
    return ['PL05_C_SSH', 'PL05_C_MYSQL', 'PL05_C_REDIS', 'PL05_T18_SSH', 'PL05_T220_SSH']
      .map((k) => process.env[k]).filter(Boolean);
  },
};

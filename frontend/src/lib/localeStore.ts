// 当前站点语言（模块级单例）。供 axios 拦截器读取并注入 ?locale= 查询参数，
// 使公开内容接口按当前语言返回译文；管理后台不注入，保持中文。
export type Locale = 'zh' | 'en';

let current: Locale = 'zh';

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
}

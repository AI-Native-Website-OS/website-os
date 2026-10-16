/**
 * 地名归一化：把 IP 归属地解析服务（ip2region / ipwho.is）返回的地名
 * 映射到 echarts 地图（DataV 中国地图 / Natural Earth 世界地图）中的名称。
 * 未命中时返回原值，保证不阻断渲染。
 */

const PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省',
  '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省',
  '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
  '台湾省', '香港特别行政区', '澳门特别行政区',
];

function stripProvinceSuffix(name: string): string {
  return name.replace(/(省|市|特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区)$/, '');
}

const PROVINCE_BY_SHORT: Record<string, string> = {};
for (const p of PROVINCES) PROVINCE_BY_SHORT[stripProvinceSuffix(p)] = p;

export function normalizeProvince(raw?: string): string {
  if (!raw) return '';
  const name = raw.trim().replace(/\s+/g, '');
  if (PROVINCES.includes(name)) return name;
  const short = stripProvinceSuffix(name);
  if (PROVINCE_BY_SHORT[short]) return PROVINCE_BY_SHORT[short];
  for (const p of PROVINCES) {
    const ps = stripProvinceSuffix(p);
    if (p.startsWith(name) || (short && ps.startsWith(short))) return p;
  }
  return name;
}

/** 中文（或常见英文）国家名 → Natural Earth 世界地图名称 */
const COUNTRY_MAP: Record<string, string> = {
  中国: 'China', 中华人民共和国: 'China', 香港: 'China', 中国香港: 'China', 澳门: 'China', 中国澳门: 'China', 台湾: 'China', 中国台湾: 'China',
  美国: 'United States', 美利坚合众国: 'United States',
  日本: 'Japan', 韩国: 'Korea', 大韩民国: 'Korea', 朝鲜: 'Dem. Rep. Korea',
  印度: 'India', 印度尼西亚: 'Indonesia', 印尼: 'Indonesia', 马来西亚: 'Malaysia', 新加坡: 'Singapore',
  泰国: 'Thailand', 越南: 'Vietnam', 菲律宾: 'Philippines', 缅甸: 'Myanmar', 柬埔寨: 'Cambodia', 老挝: 'Lao PDR',
  巴基斯坦: 'Pakistan', 孟加拉国: 'Bangladesh', 斯里兰卡: 'Sri Lanka', 尼泊尔: 'Nepal', 哈萨克斯坦: 'Kazakhstan',
  蒙古: 'Mongolia', 乌兹别克斯坦: 'Uzbekistan',
  俄罗斯: 'Russia', 俄罗斯联邦: 'Russia', 乌克兰: 'Ukraine', 白俄罗斯: 'Belarus',
  德国: 'Germany', 法国: 'France', 英国: 'United Kingdom', 大不列颠: 'United Kingdom', 意大利: 'Italy',
  西班牙: 'Spain', 葡萄牙: 'Portugal', 荷兰: 'Netherlands', 比利时: 'Belgium', 瑞士: 'Switzerland',
  瑞典: 'Sweden', 挪威: 'Norway', 丹麦: 'Denmark', 芬兰: 'Finland', 波兰: 'Poland', 奥地利: 'Austria',
  爱尔兰: 'Ireland', 希腊: 'Greece', 捷克: 'Czech Rep.', 匈牙利: 'Hungary', 罗马尼亚: 'Romania',
  土耳其: 'Turkey', 保加利亚: 'Bulgaria', 克罗地亚: 'Croatia', 塞尔维亚: 'Serbia', 斯洛伐克: 'Slovakia',
  斯洛文尼亚: 'Slovenia', 立陶宛: 'Lithuania', 拉脱维亚: 'Latvia', 爱沙尼亚: 'Estonia', 冰岛: 'Iceland',
  加拿大: 'Canada', 墨西哥: 'Mexico', 巴西: 'Brazil', 阿根廷: 'Argentina', 智利: 'Chile', 秘鲁: 'Peru',
  哥伦比亚: 'Colombia', 委内瑞拉: 'Venezuela', 厄瓜多尔: 'Ecuador', 玻利维亚: 'Bolivia', 乌拉圭: 'Uruguay',
  澳大利亚: 'Australia', 新西兰: 'New Zealand',
  南非: 'South Africa', 埃及: 'Egypt', 尼日利亚: 'Nigeria', 肯尼亚: 'Kenya', 埃塞俄比亚: 'Ethiopia',
  摩洛哥: 'Morocco', 阿尔及利亚: 'Algeria', 突尼斯: 'Tunisia', 加纳: 'Ghana', 坦桑尼亚: 'Tanzania',
  沙特阿拉伯: 'Saudi Arabia', 阿联酋: 'United Arab Emirates', 阿拉伯联合酋长国: 'United Arab Emirates',
  卡塔尔: 'Qatar', 科威特: 'Kuwait', 阿曼: 'Oman', 以色列: 'Israel', 伊朗: 'Iran', 伊拉克: 'Iraq',
  约旦: 'Jordan', 黎巴嫩: 'Lebanon', 叙利亚: 'Syria', 也门: 'Yemen', 巴林: 'Bahrain',
  阿富汗: 'Afghanistan', 阿塞拜疆: 'Azerbaijan', 格鲁吉亚: 'Georgia', 亚美尼亚: 'Armenia',
};

export function normalizeCountry(raw?: string): string {
  if (!raw) return '';
  const name = raw.trim();
  if (COUNTRY_MAP[name]) return COUNTRY_MAP[name];
  return name;
}

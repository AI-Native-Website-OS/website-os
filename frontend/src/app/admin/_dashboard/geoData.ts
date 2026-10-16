export type GeoScope = 'china' | 'world';

// GeoJSON 随源码打包进 dist（public/ 部署时不存在），按需动态加载对应 chunk。
export async function loadGeoMap(scope: GeoScope): Promise<unknown> {
  if (scope === 'china') return (await import('@/assets/geo/china.json')).default;
  return (await import('@/assets/geo/world.json')).default;
}

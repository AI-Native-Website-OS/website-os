const echarts = require('echarts/core');
const { MapChart } = require('echarts/charts');
const { TooltipComponent, VisualMapComponent } = require('echarts/components');
const { SVGRenderer } = require('echarts/renderers');
echarts.use([MapChart, TooltipComponent, VisualMapComponent, SVGRenderer]);

const china = require('./src/assets/geo/china.json');
echarts.registerMap('china', china);
const data = [
  { name: '河北省', value: 100 },
  { name: '江苏省', value: 10 },
  { name: '广东省', value: 55 },
];
const max = Math.max(...data.map(d => d.value), 1);
const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 900, height: 600 });
chart.setOption({
  tooltip: { trigger: 'item' },
  visualMap: { min: 0, max, left: 12, bottom: 12, calculable: true, inRange: { color: ['#f3f4f6', '#93c5fd', '#2563eb'] } },
  series: [{ type: 'map', map: 'china', roam: false, label: { show: false }, itemStyle: { borderColor: '#e5e7eb', borderWidth: 0.5, areaColor: '#f9fafb' }, data }],
}, true);
const svg = chart.renderToSVGString();
console.log('rgb fills:', [...new Set([...svg.matchAll(/fill="(rgb\([^"]+\))"/g)].map(m => m[1]))]);
process.exit(0);

/**
 * 国立浙江大学维基（ncku1897.net）历年杰青/优青全国名单
 * 页面格式：HTML 表格、<br />+制表符、或立项清单
 */
const NCKU_BASE = 'https://www.ncku1897.net/wiki/index.php'

function wikiPath(title) {
  return `${NCKU_BASE}/${encodeURIComponent(title)}`
}

function jieqingTitle(year) {
  return `${year}年度国家杰出青年科学基金获得者`
}

function youqingTitle(year) {
  return `${year}年度国家优秀青年科学基金获得者`
}

export const NCKU1897_SOURCES = []

for (let year = 2000; year <= 2024; year++) {
  NCKU1897_SOURCES.push({
    honor: '杰青',
    year,
    url: wikiPath(jieqingTitle(year)),
    org: '国家自然科学基金委员会',
    parser: 'ncku-wiki',
  })
}

for (let year = 2012; year <= 2019; year++) {
  NCKU1897_SOURCES.push({
    honor: '优青',
    year,
    url: wikiPath(youqingTitle(year)),
    org: '国家自然科学基金委员会',
    parser: 'ncku-wiki',
  })
}

// 2019 优青立项名单（独立页面标题）
NCKU1897_SOURCES.push({
  honor: '优青',
  year: 2019,
  url: wikiPath('2019年国家自然科学基金优秀青年基金项目立项名单'),
  org: '国家自然科学基金委员会',
  parser: 'ncku-wiki',
})

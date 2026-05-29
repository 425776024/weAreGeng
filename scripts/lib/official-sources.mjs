/** 政府机构公开数据源（优先 HTML 正文 / 官方表格） */
export const OFFICIAL_SOURCES = {
  casAcademicians: {
    org: '中国科学院学部',
    url: 'https://casad.cas.cn/ysxx2022/ysmd/qtys/',
    type: 'cas-yuanshi',
  },
  caeAcademicians: {
    org: '中国工程院',
    url: 'https://www.cae.cn/cae/html/main/col48/column_48_1.html',
    type: 'cae-yuanshi',
  },
  /** 中科院历次增选名单（含工作单位） */
  casElectionLists: [
    { year: 2003, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882104.html' },
    { year: 2005, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882105.html' },
    { year: 2007, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882106.html' },
    { year: 2009, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882107.html' },
    { year: 2011, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882108.html' },
    { year: 2013, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882109.html' },
    { year: 2015, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882110.html' },
    { year: 2017, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882118.html' },
    { year: 2019, url: 'https://casad.cas.cn/yszx/lcmd/202303/t20230328_4882115.html' },
    { year: 2023, url: 'https://casad.cas.cn/yszx/lcmd/202504/t20250402_5061082.html' },
  ],
  /** 工程院增选名单（含工作单位） */
  caeElectionLists: [
    { year: 2015, url: 'https://www.cae.cn/cae/html/main/col280/2015-12/04/20151204105337936142127_1.html' },
    { year: 2017, url: 'https://www.cae.cn/cae/html/main/col280/2017-11/27/20171127085337936142127_1.html' },
    { year: 2019, url: 'https://www.cae.cn/cae/html/main/col323/2019-11/22/20191122095745643268594_1.html' },
    { year: 2021, url: 'https://www.cae.cn/cae/html/main/col1/2021-11/18/20211118075007595415390_1.html' },
    { year: 2023, url: 'https://www.cae.cn/cae/html/main/col2260/2023-11/23/20231123090216622511192_1.html' },
  ],
  nsfcLifeSciencesIndex: {
    org: '国家自然科学基金委员会 · 生命科学部',
    url: 'https://www.nsfc.gov.cn/p1/2853/3102/sqyzz1.html',
    type: 'nsfc-index',
  },
  /** @deprecated 使用 national-talent-sources.mjs */
  nsfcNationalTalentLists: [],
  nsfcLifeSciencesTalentPages: [],
}

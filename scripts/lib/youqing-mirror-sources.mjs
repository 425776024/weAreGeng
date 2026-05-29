/**
 * 2020–2024 优青可解析镜像源（第三方转载 / 高校汇总页）
 *
 * 说明：2020 年起国自然委不再统一公布全国完整 HTML 名单；2021–2024 主要依赖
 * 各高校官网 yxqn 汇总页 + 第三方 partial 汇总。chinazhigui 等长图为 webp，无法文本解析。
 */
export const YOUQING_MIRROR_SOURCES = [
  {
    honor: '优青',
    year: 2022,
    url: 'https://wiki.antpedia.com/article-2810970',
    org: '分析测试百科网',
    parser: 'honor-announcement',
    note: '各校官宣整理，不完整',
  },
  {
    honor: '优青',
    year: 2023,
    url: 'https://wiki.antpedia.com/%E6%B1%87%E6%80%BB%7C2023%E5%B9%B4%E5%BA%A6%E5%9B%BD%E5%AE%B6%E6%9D%B0%E9%9D%92%E3%80%81%E4%BC%98%E9%89%B2%E5%90%8D%E5%8D%95-3087362-news',
    org: '分析测试百科网',
    parser: 'honor-announcement',
    note: '汇总页，正文多为导读',
  },
  {
    honor: '优青',
    year: 2024,
    url: 'https://wiki.antpedia.com/%E6%9C%80%E6%96%B0%E6%95%B4%E7%90%862024%E5%B9%B4%E5%9B%BD%E5%AE%B6%E6%9D%B0%E9%9D%92%E4%BC%98%E9%9D%92%E5%85%A5%E9%80%89%E6%83%85%E5%86%B5%E6%B1%87%E6%80%BB-3587610-news',
    org: '分析测试百科网',
    parser: 'honor-announcement',
    note: '汇总页，正文多为导读',
  },
  {
    honor: '优青',
    year: 2020,
    url: 'https://wiki.antpedia.com/2020%E5%B9%B410%E6%9C%8818%E6%97%A5%E5%85%A8%E5%9B%BD%E6%9D%B0%E9%9D%92%E4%BC%98%E9%9D%92%E6%9C%80%E6%96%B0%E5%90%8D%E5%8D%95%E5%87%BA%E7%82%89-2456777-news',
    org: '分析测试百科网',
    parser: 'honor-announcement',
    note: '含省级优青链接与统计',
  },
  {
    honor: '优青',
    year: 2020,
    url: 'https://www.chaxin.org.cn/toDetailByType?id=1597137487004751&type=technologyPolicy',
    org: '科技部西南信息中心查新中心',
    parser: 'nsfc-table',
    disabled: true,
    note: '实为 2020 杰青建议资助名单，非优青',
  },
  {
    honor: '优青',
    year: 2024,
    url: 'http://chinazhigui.com/h-nd-2184.html',
    org: '科学家之家',
    parser: 'chinazhigui-rich',
    disabled: true,
    note: '253 人名单为 webp 长图，HTML 无文本',
  },
]

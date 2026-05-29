const CJK_NAME = /^[\u4e00-\u9fff·A-Za-z\s]{2,20}$/
const SKIP_NAMES = new Set([
  '序号', '姓名', '单位', '获得年度', '申请人', '依托单位', '研究领域', '性别', '学位',
  '专业技术', '所在国别', '地区', '首页', '联系我们', '求是学人', '两院院士', '师资队伍',
  '人才工程', '友情链接', '版权所有', '当前位置', '获批年份', '工作单位', '出生年月',
  '专业', '年龄', '科学部', '负责人', '研究方向', '合计', '总计', '备注', '打印',
])

/** 高校站点导航/栏目常见文案，会被 list-links 误当成姓名 */
const NAV_LABELS = new Set([
  '本科生', '研究生', '合作交流', '本科招生', '学校概况', '办事大厅', '信息平台', '国际交流',
  '人才培养', '招生就业', '校友', '教职工', '在校生', '考生', '留学生', '继续教育', '就业信息',
  '学科建设', '科学研究', '机构设置', '信息公开', '学校简介', '校园生活', '人才招聘', '百年校史',
  '办公系统', '访客', '附属医院', '工会活动', '要闻资讯', '综合搜索', 'VPN通道', '学工快讯',
  '科研动态', '学术动态', '通知公告', '重要通知', '诚聘英才', '阳光招生', '院长信箱', '领导信箱',
  '校长信箱', '邮箱系统', '校园邮箱', '图书资源', '成长惠园', '远程教育', '招生工作', '教育教学',
  '教学培养', '育人概况', '师资概况', '师资招聘', '团队招聘', '职能简介', '机构介绍', '院士学者',
  '知名校友', '杰出校友', '杰出人才', '系列讲座', '讲座信息', '论坛公告', '活动动态', '活动新闻',
  '中文', '中文首页', '中大首页', '下载专区', '专题报道', '专题聚焦', '业务培养', '人事工作',
  '人事服务', '人事规划', '人事通知', '人员业务', '人才办', '人才发展', '人才宣传', '人才引进',
  '人物故事', '党政工团', '党委分工', '党委通讯', '党建之声', '党建公示', '党建动态', '党建工会',
  '党建工作', '党建思政', '党建指南', '党费管理', '党群工作', '工会', '工会分工', '工会简介',
  '工会新闻', '实验室', '年度报告', '动态', '统计概览', '学术刊物', '学术大咖', '学术期刊',
  '学术组织', '学术讲座', '学术科研', '学风建设', '专业介绍', '专业确认', '专项学习', '实践竞赛',
  '社会实践', '社会服务', '地方服务', '海外学习', '海外优青', '移动商务', '消费日报', '京报网',
  '交通导游', '辅助人员', '教工之家', '教研系列', '教工', '招生', '就业', '就业招生', '学生',
  '学生交流', '学生活动', '学生管理', '学生组织', '学生资助', '学生园地', '学生工作', '学生动态',
  '学生三会', '学生会', '学生社团', '校友之家', '校友会', '校友动态', '校友同乐', '校友名录',
  '校友园地', '校友家园', '校友往事', '校友总会', '校友捐赠', '校友服务', '校友杂志', '校友活动',
  '校友风采', '院系概况', '院系设置', '院工会', '院妇委会', '行政办公', '议事机构', '名人名师',
  '服务指南', '外事指南', '办事指南', '学校简述', '学校领导', '历任书记', '历任校长', '学校地图',
  '校园照片', '学院设置', '远程教学', 'English', '查看更多', '办学条件', '对口支援', '创新创业',
  '北京卫视', '历史沿革', '办学概况', '领导团队', '行政机构', '学院地图', '育人概况', '教师名录',
  '博士后', '学院介绍', '师资招聘', '视频', '成果奖', '党建', '人才', '首页', '更多', '返回',
  '上一页', '下一页', '详细', '详情', '点击', '展开', '收起', '登录', '注册', '搜索', '导航',
  '安全知识', '创新群体', '关工委', '规章制度', '基本数据', '奖贷三助', '教师', '教师队伍',
  '教书育人', '进入展厅', '孔子学院', '理念', '珞珈映像', '名誉教授', '青大标识', '全体教师',
  '商界精英', '师资力量', '师资维护', '时光剪影', '使用帮助', '双聘教授', '跳过', '头条关注',
  '退休教师', '网络邮局', '委员会', '文化标识', '文化生活', '文件表格', '进入', '网盘',
])

const COMPOUND_SURNAMES = [
  '欧阳', '司马', '上官', '诸葛', '东方', '皇甫', '尉迟', '公孙', '轩辕', '令狐', '慕容', '端木',
  '百里', '淳于', '申屠', '太史', '独孤', '南宫', '夏侯',
]

const ORG_GEO_PREFIX =
  /^(北京|上海|天津|重庆|中国|美国|英国|日本|德国|法国|澳大利亚|加拿大|俄罗斯|韩国|南方医科|华中农业|华中科技|电子科技|北京航空|北京化工|北京科技|北京师范|东北师范|大连理工|哈尔滨工业|湖南|河海|复旦|东南|东北|电子|南京|武汉|西安|成都|广州|浙江|厦门|清华|北大|中山|四川|吉林|兰州|云南|新疆|内蒙古|广西|宁夏|青海|西藏|海南|台湾|香港|澳门|乌兹别克斯坦)/

const LIST_PAGE_NOISE =
  /教师|委员会|帮助|跳过|关注|精英|维护|表格|标识|规则|群体|知识|数据|三助|规章|展厅|邮局|文化生活|文件|名誉|双聘|退休|全体|师资|文化|理念|孔子|珞珈|青大|商界|头条|创新|安全|进入|奖贷|基本|查看更多|查看|网盘|维护|映像|邮局|关工委|育人|教书|时光|使用|文件表格|文化标识|网络邮局|退休教师|头条关注|双聘教授|名誉教授|青大标识|全体教师|商界精英|师资力量|师资维护|进入展厅|孔子学院|创新群体|安全知识|规章制度|基本数据|奖贷三助|教师队伍|教书育人|珞珈映像|跳过/

const NAV_PREFIX =
  /^(学校|校园|学院|院系|机构|办事|信息|人才|招生|就业|学生|校友|科研|学术|教学|教育|培养|人事|党建|工会|党费|党群|行政|议事|设备|课程|学习|学位|学籍|学工|学风|专业|实践|社会|地方|海外|移动|消费|交通|辅助|系列|讲座|论坛|活动|新闻|通知|公告|重要|阳光|信箱|领导|校长|院长|图书|成长|远程|继续|留学|访客|附属|办公|百年|要闻|综合|通道|快讯|诚聘|招贤|团队|职能|名人|名师|人物|宣传|引进|发展|捐赠|指南|故事|企业|杂志|名录|同乐|往事|总会|家园|园地|三会|社团|资助|组织|管理|概况|简介|简述|设置|地图|照片|媒体|景观|美景|生活|邮箱|校历|宣传片|校徽|校训|校歌|沿革|分工|通讯|之声|公示|动态|思政|报道|聚焦|专区|切换|系统|平台|搜索|首页|中文)/

const NAV_INFIX =
  /(招生|交流|概况|通知|指南|服务|系统|平台|信息|就业|培养|科研|党建|工会|活动|新闻|动态|介绍|设置|下载|专题|报告|会议|邮箱|校历|捐赠|招聘|引进|风采|故事|概述|简介|工作|管理|建设|教育|教学|学习|资源|访问|公示|通讯|分工|杂志|名录|同乐|往事|总会|家园|园地|三会|社团|资助|组织|设备|课程|竞赛|实践|社会|地方|移动|消费|交通|辅助|系列|讲座|论坛|通告|邀请|专利|合作|基地|成果|论文|进展|项目|获奖|组织|大咖|期刊|刊物|学风|专业|确认|专项|业务|阳光|信箱|领导|校长|院长|图书|成长|远程|继续|留学|访客|附属|办公|百年|要闻|综合|通道|快讯|重要|诚聘|招贤|纳士|团队|职能|机构|议事|行政|名人|名师|人物|宣传|引进|发展|条件|支援|创业|更多|查看|卫视|视频|地图|沿革|名录|招聘|介绍|办$|处$|部$|组$|网$|页$)/

export function isNavLikeLabel(name) {
  if (!name) return true
  if (SKIP_NAMES.has(name) || NAV_LABELS.has(name)) return true
  if (NAV_PREFIX.test(name)) return true
  if (NAV_INFIX.test(name)) return true
  return false
}

export function isForeignPersonName(name) {
  return /[A-Za-z]/.test(name) || (name.includes('·') && name.length <= 20)
}

export function isOrgOrGeoName(name) {
  if (!name) return false
  if (/大学$|学院$|学校$|研究所|研究院|医院$|科学院|实验室$|中心$|委员会$|基金会$/.test(name)) return true
  if (ORG_GEO_PREFIX.test(name)) return true
  return false
}

function titleLooksLikeOrganization(title) {
  return /大学|学院|研究所|研究院|科学院|医院|中心|实验室/.test(title || '')
}

export function isLikelyResearchTopicName(name) {
  if (!name || COMPOUND_SURNAMES.some((s) => name.startsWith(s))) return false
  if (name.includes('的')) return true
  if (
    name.length >= 4 &&
    /学$|工程$|物理$|化学$|力学$|统计$|研究$|验证$|效应$|示踪$|湍流$|论$|程序$|仿酶$|成像$|冶金$|摄像$|编辑$|林学$/.test(
      name
    )
  )
    return true
  if (
    name.length >= 4 &&
    /(?:地质|免疫|遗传|传染|分类|分子|营养|材料|病毒|基因|纳米|量子|高分|复合|环境|海洋|空间|大气|口腔|流行|创伤|生存|微分|动物|植物|基础|浮力|核天|电催化|产胶|变质|表面|光学|病理|生理|药理|生态|晶体|薄膜|流变|噪声|信号|图像|视觉|神经|计算|功能|现象|机制|软件|理论|金属|单病|多复|传热|传质|航天|生物|代数学|结构|程序|计算|摄像|数据|编辑|生殖|天体|微电子|无机|有机|妇产|表观|固体力|防护林|计算生物|结构生物|空间结构|分子生物|动物分子|动物传染|电催化|环境放射|高可信|多铁性|多复变|浮力驱动|单病毒|航天器|神经生理|生理学|植物表观)/.test(
      name
    )
  )
    return true
  return false
}

/** 判断现有人才记录是否应保留（用于数据清洗） */
export function isValidExpertRecord(expert) {
  const name = expert?.name?.trim()
  const title = expert?.title?.trim() || ''
  const university = expert?.university?.trim() || ''
  const year = expert?.year
  const source = expert?.source || ''

  if (!name || isNavLikeLabel(name)) return false
  if (isForeignPersonName(name)) return true
  if (name.length > 4) return false
  if (isOrgOrGeoName(name)) return false
  if (name === university) return false
  if (title === name) return false
  if (isLikelyResearchTopicName(name) && titleLooksLikeOrganization(title || university)) return false
  if (!title && (isLikelyResearchTopicName(name) || isOrgOrGeoName(name))) return false
  if (
    !year &&
    !title &&
    source.includes('list.htm') &&
    (LIST_PAGE_NOISE.test(name) || isLikelyResearchTopicName(name) || isOrgOrGeoName(name))
  )
    return false
  return true
}

export function classifyInvalidExpertRecord(expert) {
  const name = expert?.name?.trim()
  const title = expert?.title?.trim() || ''
  const university = expert?.university?.trim() || ''
  const year = expert?.year
  const source = expert?.source || ''

  if (!name || isNavLikeLabel(name)) return 'nav-label'
  if (!isForeignPersonName(name) && name.length > 4) return 'too-long'
  if (isOrgOrGeoName(name)) return 'org-or-geo'
  if (name === university) return 'name-equals-university'
  if (title === name) return 'name-equals-title'
  if (isLikelyResearchTopicName(name) && titleLooksLikeOrganization(title || university))
    return 'topic-with-org-title'
  if (!title && (isLikelyResearchTopicName(name) || isOrgOrGeoName(name))) return 'topic-without-title'
  if (
    !year &&
    !title &&
    source.includes('list.htm') &&
    (LIST_PAGE_NOISE.test(name) || isLikelyResearchTopicName(name) || isOrgOrGeoName(name))
  )
    return 'list-page-noise'
  return 'valid'
}

export function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
}

function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPersonName(name) {
  if (!name || name.length < 2) return false
  if (isNavLikeLabel(name)) return false
  if (!isForeignPersonName(name) && name.length > 4) return false
  if (isOrgOrGeoName(name)) return false
  if (isLikelyResearchTopicName(name)) return false
  if (/^\d+$/.test(name)) return false
  if (/^(教授|研究员|博士|学院|大学|研究|科学|国家|基金)/.test(name)) return false
  return CJK_NAME.test(name.replace(/\s/g, ''))
}

function stripPageChrome(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(nav|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(
      /<[^>]+class="[^"]*(?:nav|menu|footer|header|breadcrumb|toolbar|sidebar|topbar|quick-link|top_link)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi,
      ''
    )
}

function isNavHref(href) {
  const h = (href || '').trim().toLowerCase()
  if (!h || h === '#' || h.startsWith('javascript:') || h.startsWith('mailto:')) return true
  if (
    /(?:xxgk|jwc|xsgz|zsb|\/zs\/|\/zs\.|jy\/|kyc|\/news\/|index\.htm|main\.htm|\/main\/|xxmh|bkjy|yjsy|xszz|gglm|\/dh\/|helper|calendar|sitemap|rss|login|logout|vpn|ehall|mail\.|lib\.|home\.)/.test(
      h
    )
  )
    return true
  if (/\.(?:html|htm)$/.test(h) && /(?:xyjs|lsyg|bxgk|ldtd|xzjg|xydt|yrgk|bks|yanjius|xsgz|ysxz|teacher_directory|rsfw|top_links|jiaosyr)/.test(h))
    return true
  return false
}

function isProfileLikeHref(href) {
  const h = (href || '').trim().toLowerCase()
  if (!h || isNavHref(h)) return false
  if (/\/info\/\d+/i.test(h)) return true
  if (
    /\/(?:teacher|faculty|people|person|professor|staff|experts?|talents?|szdw|jsxx|jsjj|ryxx|teacherinfo|facultyinfo|viewcontent|page\d+|_redirect)/i.test(
      h
    )
  )
    return true
  if (/[\?&](?:teacher|uid|id|infoid|teacherid|pageinfoid)=/i.test(h)) return true
  if (/\/\d{5,}\//.test(h) && !/\/list\.htm/.test(h)) return true
  return false
}

function extractMainContentHtml(html) {
  const stripped = stripPageChrome(html)
  const main =
    stripped.match(
      /<(?:div|section|article)[^>]+(?:class="[^"]*(?:wp_article_list|article_list|list_content|main-content|article-content|right-content|content-box|list_box)[^"]*"|id="[^"]*(?:main|content|article)[^"]*")[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i
    )?.[1] ||
    stripped.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ||
    stripped
  return main
}

function normalizeUniversity(unit, fallback) {
  const u = (unit || '').trim()
  if (!u) return fallback || ''
  if (u.length <= 20 && !/大学|学院|研究所|研究院|医院|中心|实验室|科学院/.test(u)) {
    return fallback || u
  }
  return u
}

export function parseCasAcademicians(html, sourceUrl) {
  const people = []
  const chunks = html.split(/<b>([^<]+部)<\/b>/)
  for (let i = 1; i < chunks.length; i += 2) {
    const division = chunks[i].replace(/（\d+人）/g, '').trim()
    const section = chunks[i + 1] || ''
    const linkRe =
      /<a href="https?:\/\/casad\.cas\.cn\/ysxx2022\/ysmd\/[^"]+" target="_blank">([^<]+)<\/a>/g
    for (const m of section.matchAll(linkRe)) {
      const name = m[1].trim()
      if (!isPersonName(name)) continue
      people.push(makeExpert({
        honor: '中科院院士',
        name,
        university: '中国科学院',
        field: division,
        sourceUrl,
        sourceOrg: '中国科学院学部',
      }))
    }
  }

  if (!people.length) {
    const linkRe =
      /<a href="https?:\/\/casad\.cas\.cn\/ysxx2022\/ysmd\/[^"]+" target="_blank">([^<]+)<\/a>/g
    for (const m of html.matchAll(linkRe)) {
      const name = m[1].trim()
      if (!isPersonName(name)) continue
      people.push(makeExpert({
        honor: '中科院院士',
        name,
        university: '中国科学院',
        field: '中国科学院',
        sourceUrl,
        sourceOrg: '中国科学院学部',
      }))
    }
  }

  return dedupePeople(people)
}

export function parseCasElectionList(html, meta) {
  const people = []
  let division = meta.division || '中国科学院'

  for (const chunk of html.split(/<b>([^<]+部)[^<]*<\/b>/)) {
    if (chunk.includes('学部（') || chunk.includes('学部(')) division = chunk.replace(/<[^>]+>/g, '').trim()
  }

  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...row[0].matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((m) =>
      cleanText(m[1])
    )
    if (cells.length < 4) continue
    if (cells.some((c) => c.includes('姓名'))) continue

    let nameIdx = cells.findIndex((c) => isPersonName(c.replace(/\s/g, '')))
    if (nameIdx < 0) continue

    const name = cells[nameIdx].replace(/\s/g, '')
    let university = ''
    let field = division

    if (cells.length >= 5) {
      field = cells[nameIdx + 2] || cells[nameIdx + 1] || field
      university = cells[nameIdx + 3] || cells[cells.length - 1] || ''
    } else {
      university = cells[nameIdx + 1] || ''
    }

    if (!isPersonName(name)) continue
    people.push(
      makeExpert({
        honor: '中科院院士',
        name,
        university: normalizeUniversity(university, '中国科学院'),
        field,
        year: meta.year,
        sourceUrl: meta.url,
        sourceOrg: '中国科学院学部',
      })
    )
  }

  return dedupePeople(people)
}

export function parseCaeAcademicians(html, sourceUrl) {
  const people = []
  const re = /<a href="(\/cae\/html\/main\/colys\/[^"]+)"[^>]*>([^<]+)<\/a>/g
  for (const m of html.matchAll(re)) {
    const profilePath = m[1]
    const name = m[2].trim()
    if (!isPersonName(name)) continue
    people.push(
      makeExpert({
        honor: '工程院院士',
        name,
        university: '',
        field: '中国工程院',
        sourceUrl,
        sourceOrg: '中国工程院',
        profilePath,
      })
    )
  }
  return dedupePeople(people)
}

export function parseCaeElectionList(html, meta) {
  const people = []
  let division = '中国工程院'

  const sectionRe =
    /(?:<(?:b|strong|p)[^>]*>\s*)?([^<\n]+学部)\s*(?:（\d+人）|\d+人)?/gi
  const parts = html.split(sectionRe)

  for (let i = 1; i < parts.length; i += 2) {
    division = parts[i].replace(/<[^>]+>/g, '').trim()
    const block = parts[i + 1] || ''
    people.push(...parseCaeElectionRows(block, division, meta))
  }

  if (!people.length) {
    people.push(...parseCaeElectionRows(html, division, meta))
  }

  return dedupePeople(people)
}

function parseCaeElectionRows(block, division, meta) {
  const people = []
  for (const row of block.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...row[0].matchAll(/<t[dh][\s\S]*?>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      cleanText(m[1])
    )
    if (cells.length < 2) continue
    if (cells.some((c) => c.includes('姓名') || c.includes('出生'))) continue

    let name = ''
    let university = ''

    if (cells.length >= 3 && isPersonName(cells[0].replace(/\s/g, ''))) {
      name = cells[0].replace(/\s/g, '')
      university = cells[2] || cells[1] || ''
    } else {
      const nameIdx = cells.findIndex((c) => isPersonName(c.replace(/\s/g, '')))
      if (nameIdx < 0) continue
      name = cells[nameIdx].replace(/\s/g, '')
      university = cells[nameIdx + 2] || cells[nameIdx + 1] || ''
    }

    if (!isPersonName(name) || /^\d{4}/.test(name)) continue

    people.push(
      makeExpert({
        honor: '工程院院士',
        name,
        university: normalizeUniversity(university, ''),
        field: division,
        year: meta.year,
        sourceUrl: meta.url,
        sourceOrg: '中国工程院',
      })
    )
  }
  return people
}

export function extractCaeProfileUniversity(html) {
  const text = cleanText(html)
  const patterns = [
    /现任([^，。；;]{2,40}(?:大学|学院|研究所|研究院|医院|中心|实验室))/,
    /(?:教授|研究员)[^，。；;]{0,20}(?:在|于)([^，。；;]{2,40}(?:大学|学院|研究所|研究院))/,
    /([^，。；;]{2,30}(?:大学|学院|研究所|研究院))(?:[^，。；;]{0,10}?(?:教授|研究员|院士|讲席))/,
    /工作单位[：:]\s*([^，。；;]{2,40})/,
    /((?:清华|北大|浙江|上海交通|复旦|南京|武汉|哈尔滨|西安交通|中山|同济|华中科技|北京|中国科学技术)大学)/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) {
      let unit = m[1].trim()
      unit = unit.replace(/^(?:教授|研究员|院士)/, '').trim()
      if (unit.length >= 4 && unit.length <= 40) return unit
    }
  }
  return ''
}

export function parseNsfcFundingTable(html, meta) {
  const title = (html.match(/<div class="detail-title">\s*([^<]+)/) || [])[1]?.trim() || meta.title || ''
  const honor = title.includes('优秀青年') ? '优青' : title.includes('杰出青年') ? '杰青' : meta.honor || null
  if (!honor) return []

  const yearMatch = title.match(/(20\d{2})/)
  const year = yearMatch ? Number(yearMatch[1]) : meta.year
  const deptMatch = title.match(/(.+?)(?:部|科学部)/)
  const dept = deptMatch ? deptMatch[1] : '国家自然科学基金委'

  const rows = [...html.matchAll(/<tr>\s*([\s\S]*?)<\/tr>/g)]
  const people = []

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<p>([^<]*)<\/p>/g)]
      .map((m) => m[1].replace(/&nbsp;/g, ' ').trim())
      .filter(Boolean)
    if (cells.length < 4) continue

    let nameIdx = cells.findIndex((c) => isPersonName(c) && !/^\d+$/.test(c))
    if (nameIdx < 0) {
      if (cells.length >= 4 && isPersonName(cells[3])) nameIdx = 3
      else continue
    }

    const name = cells[nameIdx]
    const university = cells[nameIdx + 1] || ''
    const field = cells[nameIdx - 1] || dept

    people.push(
      makeExpert({
        honor,
        name,
        university,
        field,
        year,
        sourceUrl: meta.url,
        sourceOrg: '国家自然科学基金委员会',
        title: cells[nameIdx - 1] || '',
      })
    )
  }

  return dedupePeople(people)
}

export function parseNsfcNationalSuggestedTable(html, meta) {
  const title = (html.match(/<title>([^<]+)/i) || [])[1] || ''
  const honor =
    meta.honor ||
    (title.includes('优秀青年') || (html.includes('优秀青年') && !html.includes('杰出青年'))
      ? '优青'
      : '杰青')
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...row[0].matchAll(/<t[dh][\s\S]*?>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      cleanText(m[1])
    )
    if (cells.length < 4) continue
    if (cells.some((c) => c.includes('申请人') || c.includes('序号'))) continue

    let nameIdx = cells.findIndex((c, i) => i > 0 && isPersonName(c.replace(/\s/g, '')))
    if (nameIdx < 0) continue

    const name = cells[nameIdx].replace(/\s/g, '')
    let university = ''
    let field = ''

    if (cells.length >= 8) {
      field = cells[nameIdx + 4] || cells[nameIdx + 3] || ''
      university = cells[nameIdx + 5] || cells[cells.length - 1] || ''
    } else if (cells.length >= 7) {
      field = cells[nameIdx + 4] || cells[nameIdx + 3] || ''
      university = cells[nameIdx + 5] || cells[6] || ''
    } else if (cells.length >= 4) {
      field = cells[nameIdx + 1] || ''
      university = cells[nameIdx + 2] || cells[cells.length - 1] || ''
    }

    if (university === '中国' || university === '男' || university === '女') {
      university = cells.find((c) => /大学|学院|研究所|研究院|科学院|医院|中心/.test(c)) || ''
    }

    if (!isPersonName(name)) continue

    people.push(
      makeExpert({
        honor,
        name,
        university,
        field,
        year,
        sourceUrl: meta.url,
        sourceOrg: meta.org || '国家自然科学基金委员会',
        title: field,
      })
    )
  }

  return dedupePeople(people)
}

function extractNckuWikiBlock(html) {
  const block =
    html.match(/mw-parser-output[\s\S]*?(?:<noscript|<div id="catlinks"|取自“)/i)?.[0] || html
  return block.split('取自“')[0]
}

function pushNsfcExpert(people, { honor, name, university, field, year, sourceUrl, sourceOrg }) {
  if (!isPersonName(name)) return
  people.push(
    makeExpert({
      honor,
      name,
      university: normalizeUniversity(university, ''),
      field,
      year,
      sourceUrl,
      sourceOrg: sourceOrg || '国家自然科学基金委员会',
      title: field,
    })
  )
}

export function parseNckuWikiBrDelimitedNsfcList(html, meta) {
  const honor = meta.honor || (html.includes('优秀青年') ? '优青' : '杰青')
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1').replace(/<[^>]+>/g, '').trim()
    if (!line || /序号|申请人|项目负责人/.test(line)) continue

    const parts = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 4 || !/^\d+$/.test(parts[0])) continue

    const name = parts[1].replace(/\s/g, '')
    let university = ''
    let field = ''

    if (parts.length >= 8) {
      field = parts[5] || parts[4] || ''
      university = parts[6] || ''
    } else if (parts.length >= 7) {
      field = parts[4] || parts[3] || ''
      university = parts[5] || parts[parts.length - 1] || ''
    } else {
      field = parts[2] || ''
      university = parts[parts.length - 1] || parts[2] || ''
    }

    if (['中国', '男', '女'].includes(university)) {
      university = parts.find((c) => /大学|学院|研究所|研究院|科学院|医院|中心|实验室/.test(c)) || ''
    }

    pushNsfcExpert(people, { honor, name, university, field, year, sourceUrl: meta.url, sourceOrg: meta.org })
  }

  return dedupePeople(people)
}

export function parseNckuWikiBrSpacedNsfcList(html, meta) {
  const honor = meta.honor || '杰青'
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const m = line.match(/^(\d+)\s+([\u4e00-\u9fff·]{2,4})\s+(男|女)\s+/)
    if (!m) continue

    const rest = line.slice(m[0].length).split(/\s+/)
    const field = rest.find((p) => p.length > 4 && !/大学|学院|研究所|博士|教授|研究员/.test(p)) || ''
    const university = rest.find((p) => /大学|学院|研究所|研究院|科学院|医院|中心|实验室/.test(p)) || ''

    pushNsfcExpert(people, {
      honor,
      name: m[2],
      university,
      field,
      year,
      sourceUrl: meta.url,
      sourceOrg: meta.org,
    })
  }

  return dedupePeople(people)
}

export function parseNckuWikiProjectNameUnitYouqingList(html, meta) {
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1').replace(/<[^>]+>/g, '').trim()
    if (!line || /项目名称|项目负责人|依托单位|批准金额/.test(line)) continue

    const parts = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 3) continue
    if (/^\d+$/.test(parts[0]) && parts.length >= 4) continue

    let name = ''
    let university = ''
    let field = parts[0] || ''

    if (parts.length >= 4 && isPersonName(parts[1]?.replace(/\s/g, ''))) {
      name = parts[1].replace(/\s/g, '')
      university = parts[2] || ''
    } else if (isPersonName(parts[0]?.replace(/\s/g, ''))) {
      name = parts[0].replace(/\s/g, '')
      university = parts[1] || ''
    } else {
      continue
    }

    if (!/大学|学院|研究所|研究院|科学院|医院|中心|实验室/.test(university)) continue

    pushNsfcExpert(people, {
      honor: '优青',
      name,
      university,
      field,
      year,
      sourceUrl: meta.url,
      sourceOrg: meta.org,
    })
  }

  return dedupePeople(people)
}

export function parseNckuWikiUnitFirstYouqingList(html, meta) {
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1').replace(/<[^>]+>/g, '').trim()
    if (!line || /编号|依托单位|项目负责人|项目名称/.test(line)) continue

    const parts = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 4 || !/^\d+$/.test(parts[0])) continue

    const university = parts[1] || ''
    const name = parts[2].replace(/\s/g, '')
    const field = parts[3] || ''

    if (!/大学|学院|研究所|研究院|科学院|医院|中心|实验室/.test(university)) continue

    pushNsfcExpert(people, {
      honor: '优青',
      name,
      university,
      field,
      year,
      sourceUrl: meta.url,
      sourceOrg: meta.org,
    })
  }

  return dedupePeople(people)
}

export function parseNckuWikiSimpleNameUnitList(html, meta) {
  const honor = meta.honor || '优青'
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1').replace(/<[^>]+>/g, '').trim()
    if (!line || /项目负责人|依托单位|序号/.test(line)) continue

    const parts = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 3 || !/^\d+$/.test(parts[0])) continue

    const name = parts[1].replace(/\s/g, '')
    const university = parts[2] || parts[parts.length - 1] || ''

    pushNsfcExpert(people, {
      honor,
      name,
      university,
      field: university,
      year,
      sourceUrl: meta.url,
      sourceOrg: meta.org,
    })
  }

  return dedupePeople(people)
}

export function parseNckuWikiYouqingFundedList(html, meta) {
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1').replace(/<[^>]+>/g, '').trim()
    if (!line || /项目名称|负责人|批准金额/.test(line)) continue

    const parts = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 6 || !/^\d+$/.test(parts[0])) continue

    const name = parts[4].replace(/\s/g, '')
    const university = parts[5] || ''
    const field = parts[3] || parts[2] || ''

    pushNsfcExpert(people, {
      honor: '优青',
      name,
      university,
      field,
      year,
      sourceUrl: meta.url,
      sourceOrg: meta.org,
    })
  }

  return dedupePeople(people)
}

export function parseNckuWikiPartialJieqingList(html, meta) {
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  for (const raw of extractNckuWikiBlock(html).split(/<br\s*\/?>/i)) {
    const line = raw.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1').replace(/<[^>]+>/g, '').trim()
    if (!line || /序号|出生年份|出生|本科毕业/.test(line)) continue

    const parts = line.split(/\t+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length < 3) continue

    const name = parts[0].replace(/\s/g, '')
    if (!isPersonName(name) || /^\d+$/.test(name)) continue

    const university =
      parts.find((p) => /大学|学院|研究所|研究院|科学院|医院|中心|实验室/.test(p)) ||
      parts[2] ||
      parts[1] ||
      ''

    pushNsfcExpert(people, {
      honor: '杰青',
      name,
      university,
      field: parts[parts.length - 1] || '',
      year,
      sourceUrl: meta.url,
      sourceOrg: meta.org,
    })
  }

  return dedupePeople(people)
}

/** ncku1897 维基：自动识别表格 / br 分隔 / 立项清单等格式 */
export function parseNckuWikiNsfcList(html, meta) {
  const honor = meta.honor || (html.includes('优秀青年') ? '优青' : '杰青')

  if (html.includes('<tr')) {
    const tableRows = parseNsfcNationalSuggestedTable(html, meta)
    if (tableRows.length) return tableRows
  }

  const parsers =
    honor === '优青'
      ? [
          parseNckuWikiYouqingFundedList,
          parseNckuWikiProjectNameUnitYouqingList,
          parseNckuWikiUnitFirstYouqingList,
          parseNckuWikiSimpleNameUnitList,
          parseNckuWikiBrDelimitedNsfcList,
          parseNckuWikiBrSpacedNsfcList,
        ]
      : [
          parseNckuWikiBrDelimitedNsfcList,
          parseNckuWikiBrSpacedNsfcList,
          parseNckuWikiPartialJieqingList,
        ]

  const results = []
  for (const parser of parsers) {
    const rows = parser(html, meta)
    if (rows.length >= 5) results.push(rows)
  }

  if (!results.length) return []
  return results.sort((a, b) => b.length - a.length)[0]
}

export function parseAntpediaInlineList(html, meta) {
  const honor = meta.honor || (html.includes('优秀青年') ? '优青' : '杰青')
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []

  const textBlock = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  const text = cleanText(textBlock)

  const re =
    /([\u4e00-\u9fff·]{2,4})(?:（[^）]{1,4}）)?(男|女)(?:教授|研究员|副教授|讲师|副研究员)(.{0,48}?)([\u4e00-\u9fffA-Za-z（）·]{4,40}(?:大学|学院|研究所|研究院|科学院|医院|中心|实验室))/g

  for (const m of text.matchAll(re)) {
    const name = m[1].replace(/\s/g, '')
    const field = m[4].trim()
    const university = m[5].trim()
    if (!isPersonName(name)) continue
    people.push(
      makeExpert({
        honor,
        name,
        university,
        field,
        year,
        sourceUrl: meta.url,
        sourceOrg: meta.org || '国家自然科学基金委员会',
        title: field,
      })
    )
  }

  // 姓名行 + 单位行（wiki.antpedia 常见排版）
  const lines = text.split(/\s+/).filter(Boolean)
  for (let i = 0; i < lines.length - 1; i++) {
    const name = lines[i].replace(/\s/g, '')
    const next = lines[i + 1]
    if (!isPersonName(name)) continue
    if (!/大学|学院|研究所|研究院|科学院|医院|中心/.test(next)) continue
    if (next.length > 40) continue
    people.push(
      makeExpert({
        honor,
        name,
        university: next,
        field: next,
        year,
        sourceUrl: meta.url,
        sourceOrg: meta.org || '国家自然科学基金委员会',
      })
    )
  }

  return dedupePeople(people)
}

/** 第三方汇总：从新闻稿中提取「X教授…入选/获批…优青」 */
export function parseHonorAnnouncementList(html, meta) {
  const honor = meta.honor || '优青'
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')

  const patterns = [
    /([\u4e00-\u9fff·]{2,4})(?:教授|研究员|副教授|讲师|副研究员|博士)[^。\n]{0,120}?(?:国家优秀青年科学基金|国家优青|优青项目|优秀青年科学基金项目)/g,
    /([\u4e00-\u9fff·]{2,4})[^。\n]{0,24}(?:入选|获批|获得)[^。\n]{0,60}?(?:国家优秀青年科学基金|国家优青|优青项目)/g,
    /(?:国家优秀青年科学基金|国家优青|优青项目)[^。\n]{0,40}(?:获得者|入选者)[^。\n]{0,20}([\u4e00-\u9fff·]{2,4})/g,
  ]

  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const name = (m[1] || m[2] || '').replace(/\s/g, '')
      if (!isPersonName(name)) continue
      let university = meta.universityName || ''
      const before = text.slice(Math.max(0, m.index - 120), m.index)
      const unitMatch = before.match(
        /([\u4e00-\u9fffA-Za-z（）·]{4,40}(?:大学|学院|研究所|研究院|科学院|医院|中心|实验室))[^。\n]{0,40}$/
      )
      if (unitMatch) university = unitMatch[1].trim()

      people.push(
        makeExpert({
          honor,
          name,
          university,
          field: university,
          year,
          sourceUrl: meta.url,
          sourceOrg: meta.org || '网络公开整理',
        })
      )
    }
  }

  return dedupePeople(people)
}

/** chinazhigui 富文本：span/p 中的「姓名 + 单位」行（2024 汇总页多为图片，通常 0 条） */
export function parseChinazhiguiRichYouqingList(html, meta) {
  const honor = meta.honor || '优青'
  const year = meta.year || Number((html.match(/(20\d{2})/) || [])[1])
  const people = []
  const sectionIdx = html.indexOf('国家优青名单汇总')
  const chunk = sectionIdx >= 0 ? html.slice(sectionIdx, sectionIdx + 120000) : html

  for (const raw of chunk.split(/<\/p>|<br\s*\/?>/i)) {
    const line = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line || line.length > 80) continue

    const m1 = line.match(
      /^([\u4e00-\u9fff·]{2,4})\s+([\u4e00-\u9fffA-Za-z（）·]{4,40}(?:大学|学院|研究所|研究院|科学院|医院|中心|实验室))/
    )
    const m2 = line.match(
      /^(\d+)\s+([\u4e00-\u9fff·]{2,4})\s+([\u4e00-\u9fffA-Za-z（）·]{4,40}(?:大学|学院|研究所|研究院|科学院|医院|中心|实验室))/
    )
    const hit = m2 || m1
    if (!hit) continue

    const name = (m2 ? hit[2] : hit[1]).replace(/\s/g, '')
    const university = (m2 ? hit[3] : hit[2]).trim()
    if (!isPersonName(name)) continue

    people.push(
      makeExpert({
        honor,
        name,
        university,
        field: university,
        year,
        sourceUrl: meta.url,
        sourceOrg: meta.org || '科学家之家',
      })
    )
  }

  return dedupePeople(people)
}

export function parseNationalTalentPage(html, meta) {
  switch (meta.parser) {
    case 'antpedia-inline':
      return parseAntpediaInlineList(html, meta)
    case 'ncku-wiki':
      return parseNckuWikiNsfcList(html, meta)
    case 'honor-announcement':
      return parseHonorAnnouncementList(html, meta)
    case 'chinazhigui-rich':
      return parseChinazhiguiRichYouqingList(html, meta)
    case 'nsfc-table':
    default:
      return parseNsfcNationalSuggestedTable(html, meta)
  }
}

export function parseUniversityTalentPage(html, meta) {
  switch (meta.type) {
    case 'table':
      return parseUniversityTable(html, meta)
    case 'name-unit-lines':
      return parseNameUnitLines(html, meta)
    case 'year-name-field':
      return parseYearNameField(html, meta)
    case 'list-links':
      return parseListLinks(html, meta)
    default:
      return parseUniversityTable(html, meta)
  }
}

function parseUniversityTable(html, meta) {
  const people = []
  for (const row of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = [...row[0].matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((m) =>
      cleanText(m[1])
    )
    if (cells.length < 2) continue
    if (cells.some((c) => SKIP_NAMES.has(c))) continue

    const nameIdx = cells.findIndex((c) => isPersonName(c.replace(/\s/g, '')))
    if (nameIdx < 0) continue

    const name = cells[nameIdx].replace(/\s/g, '')
    const unit = cells[nameIdx + 1] || ''
    const yearCell = cells.find((c) => /^19\d{2}$|^20\d{2}$/.test(c))
    const year = yearCell ? Number(yearCell) : meta.year

    people.push(
      makeExpert({
        honor: meta.honor,
        name,
        university: normalizeUniversity(unit, meta.universityName),
        field: meta.field || unit,
        year,
        sourceUrl: meta.url,
        sourceOrg: meta.universityName,
        title: unit,
      })
    )
  }
  return dedupePeople(people)
}

function parseNameUnitLines(html, meta) {
  const people = []
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  const chunks = text.split(/<tr[\s\S]*?<\/tr>|<p[^>]*>|<li[^>]*>/gi)

  let pendingName = ''
  for (const chunk of chunks) {
    const line = cleanText(chunk)
    if (!line) continue
    if (isPersonName(line.replace(/\s/g, ''))) {
      pendingName = line.replace(/\s/g, '')
      continue
    }
    if (pendingName && /大学|学院|研究所|研究院|医院|中心/.test(line)) {
      people.push(
        makeExpert({
          honor: meta.honor,
          name: pendingName,
          university: normalizeUniversity(line, meta.universityName),
          field: line,
          sourceUrl: meta.url,
          sourceOrg: meta.universityName,
        })
      )
      pendingName = ''
    }
  }

  return dedupePeople(people)
}

function parseYearNameField(html, meta) {
  const people = []
  const lines = cleanText(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')).split(/\s{2,}/)

  for (let i = 0; i < lines.length; i++) {
    const year = lines[i]
    if (!/^19\d{2}$|^20\d{2}$/.test(year)) continue
    const name = lines[i + 1]?.replace(/\s/g, '')
    const field = lines[i + 2] || ''
    if (!isPersonName(name)) continue
    people.push(
      makeExpert({
        honor: meta.honor,
        name,
        university: meta.universityName,
        field,
        year: Number(year),
        sourceUrl: meta.url,
        sourceOrg: meta.universityName,
        title: field,
      })
    )
  }

  return dedupePeople(people)
}

function parseListLinks(html, meta) {
  const people = []
  const contentHtml = extractMainContentHtml(html)

  for (const m of contentHtml.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\u4e00-\u9fff·A-Za-z]{2,4})<\/a>/g)) {
    const href = m[1].trim()
    const name = m[2].trim()
    if (!isPersonName(name)) continue
    if (isNavHref(href)) continue
    if (!isProfileLikeHref(href)) continue
    people.push(
      makeExpert({
        honor: meta.honor,
        name,
        university: meta.universityName,
        field: meta.field || meta.universityName,
        sourceUrl: meta.url,
        sourceOrg: meta.universityName,
      })
    )
  }
  return dedupePeople(people)
}

export function discoverNsfcTalentListPages(listHtml, baseUrl) {
  const pages = []
  const seen = new Set()

  const patterns = [
    /<a[^>]+href="(\/p1\/[^"]+\.html)"[^>]*>[\s\S]*?(?:item-right-content">|title">)([^<]+)/g,
    /href="(\/p1\/2853\/3102\/726[0-9]+\.html)"[^>]*>[\s\S]*?<div class="item-right-content">([^<]+)/g,
    /href="(\/p1\/2853\/3102\/726[0-9]+\.html)"/g,
  ]

  for (const re of patterns) {
    for (const m of listHtml.matchAll(re)) {
      const path = m[1]
      const title = (m[2] || path).replace(/\s+/g, ' ').trim()
      if (seen.has(path)) continue
      if (!/杰出青年|优秀青年|杰青|优青/.test(title + path)) continue
      seen.add(path)
      pages.push({ path, title, url: new URL(path, baseUrl).href })
    }
  }

  return pages
}

export function mergeAllExperts(lists) {
  const map = new Map()
  for (const list of lists) {
    for (const p of list) {
      const key = `${p.name}|${p.honor}`
      const prev = map.get(key)
      if (!prev) {
        map.set(key, { ...p })
        continue
      }
      prev.university = pickBetterUniversity(prev.university, p.university)
      if (!prev.field && p.field) prev.field = p.field
      if (!prev.title && p.title) prev.title = p.title
      if (p.year && !prev.tags.includes(String(p.year))) prev.tags.push(String(p.year))
      if (p.source && !prev.source?.includes(p.source)) prev.source = p.source
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

function pickBetterUniversity(a, b) {
  const score = (u) => {
    if (!u?.trim()) return 0
    if (u === '中国科学院' || u === '中国工程院') return 1
    if (/大学|学院|研究所|研究院|医院/.test(u)) return 3
    return 2
  }
  return score(b) > score(a) ? b : a || b
}

function makeExpert({ honor, name, university, field, sourceUrl, sourceOrg, title = '', year, profilePath }) {
  const tags = [honor]
  if (year) tags.push(String(year))
  const expert = {
    id: `${slugify(honor)}-${slugify(name)}`,
    name,
    title,
    university,
    field,
    tags,
    honor,
    year,
    source: sourceUrl,
    sourceOrg,
  }
  if (profilePath) expert.profilePath = profilePath
  return expert
}

function dedupePeople(list) {
  return mergeAllExperts([list])
}

import {
  UNIVERSITY_DOMAIN_OVERRIDES,
  UNIVERSITY_TALENT_PATHS,
  UNIVERSITY_SUBDOMAINS,
} from './university-domains.mjs'

export function getUniversityDomain(universityId) {
  return UNIVERSITY_DOMAIN_OVERRIDES[universityId] || `${universityId}.edu.cn`
}

export function buildUniversityProbeUrls(universityId) {
  const domain = getUniversityDomain(universityId)
  const priority = [
    `https://ac.${domain}/17158/list.htm`,
    `https://www.${domain}/17158/list.htm`,
    `http://ac.${domain}/17158/list.htm`,
    `https://life.${domain}/yxqn/list.htm`,
    `https://bio.${domain}/yxqn/list.htm`,
    `https://lifesciences.${domain}/yxqn/list.htm`,
    `https://faculty.${domain}/yxqn/list.htm`,
    `https://ac.${domain}/yxqn/list.htm`,
    `https://www.${domain}/yxqn/list.htm`,
    `https://life.${domain}/yxqxjjhdz/list.htm`,
    `https://hr.${domain}/yxqxjjhdz/list.htm`,
    `https://rsrc.${domain}/gjjcqnjjhdz/list.htm`,
    `https://kfy.${domain}/gjjcqnjjhdz/list.htm`,
    `https://kfy.${domain}/kjrc/gjjcqnjjhdz_Al.htm`,
    `https://ins.${domain}/gjjcqnkxjjhdz/list.htm`,
    `https://life.${domain}/28176/list.htm`,
    `https://me.${domain}/jqjjhdz/list.htm`,
    `https://hr.${domain}/gjjcqnjjhdz/list.htm`,
    `https://hr.${domain}/qqrj/list.htm`,
    `https://rsrc.${domain}/qqrj/list.htm`,
    `https://www.${domain}/qqrj/list.htm`,
    `https://www.${domain}/gjjcqnjjhdz/list.htm`,
    `https://${domain}/17158/list.htm`,
  ]
  const urls = new Set(priority)
  for (const sub of ['ac', 'www', 'rsrc', 'kfy', 'hr', 'life', 'bio', 'faculty', 'lifesciences']) {
    for (const path of UNIVERSITY_TALENT_PATHS.slice(0, 10)) {
      urls.add(`https://${sub}.${domain}${path}`)
    }
  }
  return [...urls]
}

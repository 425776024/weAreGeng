export const UNKNOWN_ORG = '未知'

const ORG_KEYWORDS =
  /大学|学院|研究所|研究院|医院|中心|实验室|科学院|公司|集团|部队|学校|总院|附[属属]?|设计院|监测|检定|计量|局|委|部|院$|实验室|研究院|中心/

const PERSON_NAME = /^[\u4e00-\u9fff·A-Za-z]{2,4}$/

/** 清洗并校验单位名，无效则归入「未知」 */
export function normalizeOrgName(raw, fallbackField = '') {
  if (!raw?.trim() || raw.trim() === '未标注单位') return UNKNOWN_ORG

  let name = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/取自[\s\S]*$/i, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/&amp;oldid=\d+/gi, '')
    .trim()

  if (!name) return UNKNOWN_ORG

  if (isValidOrgName(name)) return name

  const fromField = pickOrgFromText(fallbackField)
  if (fromField && isValidOrgName(fromField)) return fromField

  return UNKNOWN_ORG
}

export function isValidOrgName(name) {
  if (!name || name.length < 2) return false
  if (/取自|ncku1897|mw-parser|oldid=|index\.php/i.test(name)) return false
  if (/[\r\n]/.test(name)) return false
  if (PERSON_NAME.test(name.replace(/\s/g, ''))) return false
  if (ORG_KEYWORDS.test(name)) return true
  if (name.length >= 8 && name.length <= 40 && /[\u4e00-\u9fff]/.test(name)) {
    return /(?:中国|国家|北京|上海|广东|浙江|江苏|四川|湖北|陕西|中科院)/.test(name)
  }
  return false
}

function pickOrgFromText(text) {
  if (!text?.trim()) return ''
  const m = text.match(/([\u4e00-\u9fffA-Za-z（）·0-9]{4,48}(?:大学|学院|研究所|研究院|科学院|医院|中心|实验室))/)
  return m?.[1]?.trim() || ''
}

export function slugifyOrg(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .slice(0, 80) || 'unknown'
}

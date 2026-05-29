import { execFileSync } from 'child_process'

const UA = 'Mozilla/5.0 (compatible; WeAreGeng/1.0; +https://github.com/)'

export function fetchText(url, encoding, timeoutSec = 45) {
  const args = ['-sL', '--compressed', '-A', UA, '--max-time', String(timeoutSec), url]
  if (encoding) args.unshift('-H', `Accept-Charset: ${encoding}`)
  const buf = execFileSync('/usr/bin/curl', args, { maxBuffer: 32 * 1024 * 1024 })
  if (encoding === 'gb2312' || encoding === 'gbk') {
    try {
      const iconv = execFileSync('iconv', ['-f', encoding, '-t', 'utf-8'], { input: buf, maxBuffer: 32 * 1024 * 1024 })
      return iconv.toString('utf-8')
    } catch {
      return buf.toString('binary')
    }
  }
  return buf.toString('utf-8')
}

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api/client'

type SettingsSection = 'llm' | 'search' | 'sources' | 'mcp' | 'general'

interface SourcesState {
  semanticScholar: boolean
  crossref: boolean
  arxiv: boolean
  pubmed: boolean
  openAlex: boolean
}

const sections: { id: SettingsSection; label: string; desc: string }[] = [
  { id: 'llm', label: '大模型', desc: 'LLM API 连接与参数' },
  { id: 'search', label: '联网搜索', desc: 'Serper / Tavily 等 API' },
  { id: 'sources', label: '学术来源', desc: '论文检索数据源' },
  { id: 'mcp', label: 'MCP', desc: 'Cursor 外部 Agent 接入' },
  { id: 'general', label: '通用', desc: '运行环境与说明' },
]

const activeSection = ref<SettingsSection>('llm')

const baseUrl = ref('https://api.openai.com/v1')
const apiKey = ref('')
const model = ref('gpt-4o-mini')
const temperature = ref(0.2)

const searchEnabled = ref(true)
const searchProvider = ref('duckduckgo')
const searchApiKey = ref('')

const mcpSemanticScholar = ref(false)

const sources = ref<SourcesState>({
  semanticScholar: true,
  crossref: true,
  arxiv: true,
  pubmed: false,
  openAlex: true,
})

const sourceItems: { key: keyof SourcesState; label: string; hint: string }[] = [
  { key: 'semanticScholar', label: 'Semantic Scholar', hint: '公开论文图谱，引用与摘要' },
  { key: 'crossref', label: 'CrossRef', hint: 'DOI 注册机构，期刊论文元数据' },
  { key: 'arxiv', label: 'arXiv', hint: '预印本论文库' },
  { key: 'openAlex', label: 'OpenAlex', hint: '开放学术图谱，机构与作者关联' },
  { key: 'pubmed', label: 'PubMed', hint: '生物医学文献数据库' },
]

const llmConfigured = ref(false)
const searchConfigured = ref(false)
const testResult = ref('')
const saving = ref(false)
const saveMessage = ref('')
const clientMode = 'Tauri 桌面客户端'

const MASKED_KEY = '***'

function isMaskedKey(value: string) {
  return value === MASKED_KEY
}

function keyPatch(value: string) {
  if (!value || isMaskedKey(value)) return {}
  return { apiKey: value }
}

function onApiKeyFocus() {
  if (isMaskedKey(apiKey.value)) apiKey.value = ''
}

function onApiKeyBlur() {
  if (!apiKey.value.trim() && llmConfigured.value) apiKey.value = MASKED_KEY
}

function onSearchApiKeyFocus() {
  if (isMaskedKey(searchApiKey.value)) searchApiKey.value = ''
}

function onSearchApiKeyBlur() {
  if (!searchApiKey.value.trim() && searchConfigured.value) searchApiKey.value = MASKED_KEY
}

const mcpConfigJson = `{
  "mcpServers": {
    "we-are-geng": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/path/to/weAreGeng",
      "env": {
        "WEAREGENG_LLM_API_KEY": "your-api-key"
      }
    }
  }
}`

async function copyMcpConfig() {
  try {
    await navigator.clipboard.writeText(mcpConfigJson)
    showSaveMessage('MCP 配置已复制')
  } catch {
    showSaveMessage('复制失败，请手动复制')
  }
}

onMounted(async () => {
  const cfg = await api.getConfig()
  baseUrl.value = cfg.llm.baseUrl
  model.value = cfg.llm.model
  temperature.value = cfg.llm.temperature
  apiKey.value = cfg.llm.apiKey
  searchEnabled.value = cfg.search.enabled
  searchProvider.value = cfg.search.provider
  searchApiKey.value = cfg.search.apiKey
  mcpSemanticScholar.value = cfg.mcp?.semanticScholarEnabled ?? false
  sources.value = { ...cfg.sources }
  llmConfigured.value = cfg.llmConfigured
  searchConfigured.value = Boolean(cfg.search.apiKey)
})

function showSaveMessage(msg: string) {
  saveMessage.value = msg
  setTimeout(() => {
    if (saveMessage.value === msg) saveMessage.value = ''
  }, 2500)
}

async function saveLlm() {
  saving.value = true
  try {
    const res = await api.updateConfig({
      llm: {
        baseUrl: baseUrl.value,
        ...keyPatch(apiKey.value),
        model: model.value,
        temperature: temperature.value,
      },
    })
    const cfg = await api.getConfig()
    llmConfigured.value = cfg.llmConfigured
    apiKey.value = cfg.llm.apiKey
    showSaveMessage(res.llmConfigured ? '大模型设置已保存' : '已保存，请填写 API Key')
  } finally {
    saving.value = false
  }
}

async function saveSearch() {
  saving.value = true
  try {
    await api.updateConfig({
      search: {
        enabled: searchEnabled.value,
        provider: searchProvider.value,
        ...keyPatch(searchApiKey.value),
      },
    })
    const cfg = await api.getConfig()
    searchApiKey.value = cfg.search.apiKey
    searchConfigured.value = Boolean(cfg.search.apiKey)
    if (searchProvider.value === 'duckduckgo') {
      searchConfigured.value = true
    }
    showSaveMessage('联网搜索设置已保存')
  } finally {
    saving.value = false
  }
}

async function saveSources() {
  saving.value = true
  try {
    await api.updateConfig({ sources: { ...sources.value } })
    showSaveMessage('学术来源设置已保存')
  } finally {
    saving.value = false
  }
}

async function saveMcp() {
  saving.value = true
  try {
    await api.updateConfig({
      mcp: { semanticScholarEnabled: mcpSemanticScholar.value },
    })
    showSaveMessage('MCP 设置已保存')
  } finally {
    saving.value = false
  }
}

async function testLLM() {
  testResult.value = '测试中...'
  try {
    const draftKey = apiKey.value.trim()
    const res = await api.testLLM(
      draftKey && !isMaskedKey(draftKey)
        ? {
            baseUrl: baseUrl.value,
            apiKey: draftKey,
            model: model.value,
            temperature: temperature.value,
          }
        : null,
    )
    testResult.value = res.ok ? `连接成功: ${res.reply}` : `失败: ${res.error}`
  } catch (err) {
    testResult.value = `失败: ${err instanceof Error ? err.message : String(err)}`
  }
}
</script>

<template>
  <div class="settings">
    <header class="page-head settings-head">
      <h1>设置</h1>
      <p class="desc">配置大模型、联网搜索与学术检索来源，设置将自动持久化保存</p>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置菜单">
        <button
          v-for="item in sections"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ active: activeSection === item.id }"
          @click="activeSection = item.id"
        >
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-desc">{{ item.desc }}</span>
        </button>
      </nav>

      <div class="settings-panel">
        <Transition name="fade" mode="out-in">
          <!-- 大模型 -->
          <div v-if="activeSection === 'llm'" key="llm" class="card section">
            <div class="section-title">
              <h2>大模型 (LLM)</h2>
              <span class="status-badge" :class="llmConfigured ? 'ok' : 'warn'">
                {{ llmConfigured ? '已配置' : '未配置' }}
              </span>
            </div>
            <p class="hint">用于论文深度分析与虚假内容检测</p>
            <div class="grid-2">
              <div class="form-group">
                <label>Base URL</label>
                <input v-model="baseUrl" placeholder="https://api.openai.com/v1" />
              </div>
              <div class="form-group">
                <label>API Key</label>
                <input
                  v-model="apiKey"
                  type="password"
                  placeholder="请输入 API Key"
                  @focus="onApiKeyFocus"
                  @blur="onApiKeyBlur"
                />
              </div>
              <div class="form-group">
                <label>模型</label>
                <input v-model="model" placeholder="gpt-4o-mini" />
              </div>
              <div class="form-group">
                <label>Temperature</label>
                <input v-model.number="temperature" type="number" step="0.1" min="0" max="2" />
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-primary" :disabled="saving" @click="saveLlm">保存</button>
              <button class="btn btn-secondary" @click="testLLM">测试连接</button>
              <span v-if="testResult" class="inline-msg">{{ testResult }}</span>
            </div>
          </div>

          <!-- 联网搜索 -->
          <div v-else-if="activeSection === 'search'" key="search" class="card section">
            <div class="section-title">
              <h2>联网搜索</h2>
              <span class="status-badge" :class="searchConfigured || searchProvider === 'duckduckgo' ? 'ok' : 'warn'">
                {{ searchProvider === 'duckduckgo' ? 'CrossRef 公开' : searchConfigured ? '已配置' : '未配置' }}
              </span>
            </div>
            <p class="hint">辅助检索最新网页信息与补充论文线索</p>
            <div class="form-group toggle-row">
              <label class="toggle-label">
                <input v-model="searchEnabled" type="checkbox" />
                <span>启用联网搜索</span>
              </label>
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label>搜索提供商</label>
                <select v-model="searchProvider" :disabled="!searchEnabled">
                  <option value="duckduckgo">CrossRef 公开检索 (默认)</option>
                  <option value="serper">Serper (Google)</option>
                  <option value="tavily">Tavily</option>
                </select>
              </div>
              <div class="form-group">
                <label>搜索 API Key</label>
                <input
                  v-model="searchApiKey"
                  type="password"
                  placeholder="Serper / Tavily Key"
                  :disabled="!searchEnabled || searchProvider === 'duckduckgo'"
                  @focus="onSearchApiKeyFocus"
                  @blur="onSearchApiKeyBlur"
                />
              </div>
            </div>
            <div class="actions">
              <button class="btn btn-primary" :disabled="saving" @click="saveSearch">保存</button>
            </div>
          </div>

          <!-- 学术来源 -->
          <div v-else-if="activeSection === 'sources'" key="sources" class="card section">
            <div class="section-title">
              <h2>学术搜索来源</h2>
            </div>
            <p class="hint">选择在论文检索时启用的数据源，至少保留一个来源</p>
            <ul class="source-list">
              <li v-for="item in sourceItems" :key="item.key" class="source-item">
                <label class="source-toggle">
                  <input v-model="sources[item.key]" type="checkbox" />
                  <span class="source-info">
                    <span class="source-name">{{ item.label }}</span>
                    <span class="source-hint">{{ item.hint }}</span>
                  </span>
                </label>
              </li>
            </ul>
            <div class="actions">
              <button class="btn btn-primary" :disabled="saving" @click="saveSources">保存</button>
            </div>
          </div>

          <!-- MCP -->
          <div v-else-if="activeSection === 'mcp'" key="mcp" class="card section">
            <div class="section-title">
              <h2>MCP</h2>
            </div>
            <h3 class="subheading">MCP Server（对外暴露 Tool）</h3>
            <p class="hint">在 Cursor / Claude Desktop 中接入 WeAreGeng 论文搜索与分析 Tool</p>
            <dl class="info-list">
              <div class="info-row">
                <dt>启动命令</dt>
                <dd><code>npm run mcp:server</code></dd>
              </div>
              <div class="info-row">
                <dt>环境变量</dt>
                <dd><code>WEAREGENG_LLM_API_KEY</code>（analyze_paper 必填）</dd>
              </div>
              <div class="info-row">
                <dt>文档</dt>
                <dd>详见项目 <code>docs/MCP.md</code></dd>
              </div>
            </dl>
            <pre class="mcp-config">{{ mcpConfigJson }}</pre>
            <div class="actions">
              <button class="btn btn-secondary" type="button" @click="copyMcpConfig">复制配置</button>
            </div>

            <h3 class="subheading">MCP Client（接入外部 Tool）</h3>
            <p class="hint">
              Agent 编排通过 <code>@mastra/mcp</code> 连接
              <code>@yogsoth-ai/semantic-scholar-mcp</code>。启用后，Tauri 桌面 Agent（Node 子进程）会合并
              <code>semantic-scholar_*</code> 工具。
            </p>
            <label class="toggle-row">
              <input v-model="mcpSemanticScholar" type="checkbox" />
              <span>启用 Semantic Scholar MCP Client</span>
            </label>
            <dl class="info-list">
              <div class="info-row">
                <dt>S2 API Key</dt>
                <dd>使用「联网搜索」配置中的 API Key（可选，提高限额）</dd>
              </div>
              <div class="info-row">
                <dt>环境变量回退</dt>
                <dd><code>WEAREGENG_MCP_S2_ENABLED=1</code>（MCP Server 子进程）</dd>
              </div>
            </dl>
            <div class="actions">
              <button class="btn btn-primary" :disabled="saving" @click="saveMcp">保存 MCP 设置</button>
            </div>
          </div>

          <!-- 通用 -->
          <div v-else key="general" class="card section">
            <div class="section-title">
              <h2>通用</h2>
            </div>
            <dl class="info-list">
              <div class="info-row">
                <dt>运行模式</dt>
                <dd>{{ clientMode }}</dd>
              </div>
              <div class="info-row">
                <dt>配置存储</dt>
                <dd>应用配置目录 config.json</dd>
              </div>
              <div class="info-row">
                <dt>代理能力</dt>
                <dd>Rust 后端 http_proxy 已启用</dd>
              </div>
            </dl>
          </div>
        </Transition>

        <p v-if="saveMessage" class="save-toast">{{ saveMessage }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  width: 100%;
  max-width: 880px;
  padding: 8px 0 48px;
}
.settings-head {
  text-align: center;
  padding-bottom: 32px;
}
.settings-head .desc {
  max-width: 520px;
  margin-inline: auto;
}

.settings-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.settings-nav {
  flex-shrink: 0;
  width: 168px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  top: 24px;
}

.settings-nav .nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.settings-nav .nav-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.settings-nav .nav-item.active {
  background: var(--bg-card);
  border-color: var(--border);
  color: var(--text);
}
.nav-label {
  font-size: 13px;
  font-weight: 600;
}
.nav-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.3;
}
.settings-nav .nav-item.active .nav-desc {
  color: var(--text-secondary);
}

.settings-panel {
  flex: 1;
  min-width: 0;
  position: relative;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.section-title h2 {
  font-size: 16px;
  font-weight: 600;
}
.status-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
}
.status-badge.ok {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 40%, var(--border));
}
.status-badge.warn {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 40%, var(--border));
}

.hint {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 20px;
}

.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
.inline-msg {
  font-size: 13px;
  color: var(--text-muted);
}

.toggle-row {
  margin-bottom: 16px;
}
.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text);
  cursor: pointer;
}
.toggle-label input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.source-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.source-item {
  border-bottom: 1px solid var(--border);
}
.source-item:last-child {
  border-bottom: none;
}
.source-toggle {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 4px;
  cursor: pointer;
}
.source-toggle input {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  accent-color: var(--accent);
}
.source-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.source-name {
  font-size: 14px;
  font-weight: 500;
}
.source-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-row dt {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}
.info-row dd {
  font-size: 14px;
  color: var(--text);
}
.subheading {
  margin: 1.25rem 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.mcp-config {
  margin-top: 12px;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-hover);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.save-toast {
  position: absolute;
  bottom: -36px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: var(--success);
  white-space: nowrap;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .settings-layout {
    flex-direction: column;
  }
  .settings-nav {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    position: static;
  }
  .settings-nav .nav-item {
    flex: 1 1 calc(50% - 4px);
    min-width: 140px;
  }
  .nav-desc {
    display: none;
  }
}
</style>

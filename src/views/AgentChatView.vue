<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAgentStore } from '../stores/agent'
import { tauriPickFile } from '../api/tauri-backend'

const agent = useAgentStore()
const input = ref('')

onMounted(() => {
  agent.loadSessions()
  agent.refreshNodeStatus()
})

async function submit() {
  const text = input.value.trim()
  if (!text || agent.loading) return
  input.value = ''
  await agent.send(text)
}

async function pickPdf() {
  const path = await tauriPickFile(['pdf'])
  if (path) {
    input.value = `请分析本地 PDF 文件：${path}`
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="agent-page">
    <header class="agent-header">
      <h1>Agent 助手</h1>
      <p class="subtitle">Mastra Agent：论文搜索、引用链、专家检索、AI 分析、本地 PDF/文件、会话记忆</p>
      <div v-if="agent.nodeStatus" class="runtime-badge" :class="{ ok: agent.nodeStatus.available }">
        {{
          agent.nodeStatus.available
            ? agent.nodeStatus.bundled
              ? 'Mastra Agent · 内置 Node 已就绪'
              : 'Mastra Agent · Node 已就绪'
            : 'Mastra Agent 不可用'
        }}
      </div>
      <div class="header-actions">
        <button type="button" class="btn-secondary" @click="pickPdf">选择 PDF</button>
        <button type="button" class="btn-secondary" @click="agent.clear">新对话</button>
      </div>
    </header>

    <div v-if="agent.nodeStatus && !agent.nodeStatus.available" class="banner warn">
      Node Agent 未就绪：{{ agent.nodeStatus.bundled ? '内置运行时异常' : '请运行 npm run setup:node' }}
    </div>

    <div class="agent-layout">
      <aside v-if="agent.sessions.length" class="session-panel">
        <h2>历史会话</h2>
        <button
          v-for="s in agent.sessions"
          :key="s.id"
          type="button"
          class="session-item"
          :class="{ active: agent.sessionId === s.id }"
          @click="agent.loadSession(s.id)"
        >
          <span class="session-title">{{ s.title || '未命名对话' }}</span>
          <span class="session-time">{{ s.updatedAt?.slice(0, 16) }}</span>
        </button>
      </aside>

      <div class="chat-main">
        <div class="chat-panel">
          <div v-if="!agent.messages.length" class="empty">
            <p>示例问题：</p>
            <ul>
              <li>搜索「深度学习」相关高引论文</li>
              <li>查找某篇论文的引用链（谁引用了它）</li>
              <li>分析某篇论文摘要中的可疑之处</li>
            </ul>
          </div>

          <div v-for="(msg, i) in agent.messages" :key="i" class="msg" :class="msg.role">
            <span class="role">{{ msg.role === 'user' ? '你' : msg.role === 'tool' ? `工具${msg.name ? ` · ${msg.name}` : ''}` : '助手' }}</span>
            <pre class="content">{{ msg.content }}</pre>
          </div>

          <div v-if="agent.loading && agent.streamingText" class="msg assistant">
            <span class="role">助手</span>
            <pre class="content">{{ agent.streamingText }}▍</pre>
          </div>

          <div v-if="agent.loading && !agent.streamingText" class="loading">思考中…</div>
          <div v-if="agent.error" class="banner error">{{ agent.error }}</div>
        </div>

        <div class="composer">
          <textarea
            v-model="input"
            rows="3"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            :disabled="agent.loading"
            @keydown="onKeydown"
          />
          <button type="button" class="btn-primary" :disabled="agent.loading || !input.trim()" @click="submit">
            发送
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 0 32px;
  min-height: calc(100vh - 48px);
}
.agent-header h1 {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 4px;
}
.subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
}
.runtime-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: var(--bg-muted, #f0f0f0);
  color: var(--text-muted);
}
.runtime-badge.ok {
  background: #e8f5e9;
  color: #2e7d32;
}
.header-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.agent-layout {
  display: flex;
  gap: 16px;
  min-height: 480px;
}
.session-panel {
  width: 200px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 12px;
  overflow-y: auto;
  max-height: 560px;
}
.session-panel h2 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.session-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  padding: 8px;
  margin-bottom: 4px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  color: var(--text);
}
.session-item:hover,
.session-item.active {
  background: var(--bg-hover);
}
.session-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.session-time {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.chat-panel {
  flex: 1;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  padding: 16px;
  min-height: 360px;
  max-height: 520px;
  overflow-y: auto;
}
.empty {
  color: var(--text-muted);
  font-size: 13px;
}
.empty ul {
  margin: 8px 0 0;
  padding-left: 20px;
}
.msg {
  margin-bottom: 12px;
}
.msg.user .content {
  background: var(--bg-hover);
}
.msg.tool .content {
  background: color-mix(in srgb, var(--warning) 8%, transparent);
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}
.msg.tool .role {
  color: var(--warning);
}
.role {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.55;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
}
.loading {
  color: var(--text-muted);
  font-size: 13px;
}
.banner {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.banner.warn {
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
}
.banner.error {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
}
.composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.composer textarea {
  flex: 1;
  resize: vertical;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
}
.btn-primary,
.btn-secondary {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--border);
}
.btn-primary {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-secondary {
  background: var(--bg-card);
  color: var(--text);
}
</style>

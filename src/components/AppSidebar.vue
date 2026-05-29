<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

defineProps<{
  collapsed?: boolean
}>()

defineEmits<{
  toggle: []
}>()

const route = useRoute()

const navItems = [
  { to: '/', name: 'home', label: '首页', match: (p: string) => p === '/' },
  {
    to: '/schools',
    name: 'schools',
    label: '学校',
    match: (p: string) => p === '/schools' || p.startsWith('/university/'),
  },
  {
    to: '/experts',
    name: 'experts',
    label: '人物',
    match: (p: string) => p === '/experts' || p.startsWith('/experts/'),
  },
  { to: '/analyze', name: 'analyze', label: '分析', match: (p: string) => p === '/analyze' },
  { to: '/bookmarks', name: 'bookmarks', label: '收藏', match: (p: string) => p === '/bookmarks' },
  { to: '/investigate', name: 'investigate', label: '调查', match: (p: string) => p === '/investigate' },
  { to: '/agent', name: 'agent', label: 'Agent', match: (p: string) => p === '/agent' },
]

const settingsActive = computed(() => route.path === '/settings')

function isActive(match: (p: string) => boolean) {
  return match(route.path)
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="sidebar-drag" data-tauri-drag-region />

    <div class="sidebar-brand">
      <RouterLink to="/" class="brand-link">
        <span class="brand-icon">杠</span>
        <div v-if="!collapsed" class="brand-text">
          <span class="brand-name">WeAreGeng</span>
          <span class="brand-sub">学术打假搜索</span>
        </div>
      </RouterLink>
    </div>

    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.match) }"
        :title="item.label"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg v-if="item.name === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke-linejoin="round" />
          </svg>
          <svg v-else-if="item.name === 'schools'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" stroke-linejoin="round" />
            <path d="M9 21V12h6v9" />
          </svg>
          <svg v-else-if="item.name === 'experts'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke-linecap="round" />
          </svg>
          <svg v-else-if="item.name === 'agent'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round" />
            <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="19" cy="5" r="2" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path d="M4 18V6l8-3 8 3v12l-8 3-8-3Z" stroke-linejoin="round" />
            <path d="M12 9v9M8 7.5v9.5M16 7.5v9.5" stroke-linecap="round" />
          </svg>
        </span>
        <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-footer">
      <RouterLink
        to="/settings"
        class="nav-item settings-item"
        :class="{ active: settingsActive }"
        title="设置"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" stroke-linecap="round" />
          </svg>
        </span>
        <span v-if="!collapsed" class="nav-label">设置</span>
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  min-width: 220px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  overflow: hidden;
  transition: width 0.2s ease, min-width 0.2s ease;
}
.sidebar.collapsed {
  width: 64px;
  min-width: 64px;
}
.sidebar-drag {
  height: 40px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}
.sidebar-brand {
  padding: 0 12px 16px;
  flex-shrink: 0;
}
.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.brand-link:hover {
  background: var(--bg-hover);
}
.brand-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 15px;
}
.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.brand-name {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.brand-sub {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.2;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
  flex: 1;
}
.sidebar-footer {
  padding: 12px 8px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  -webkit-app-region: no-drag;
}
.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.nav-item.active {
  background: var(--bg-hover);
  color: var(--text);
}
.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-icon svg {
  width: 18px;
  height: 18px;
}
.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 10px;
}
.sidebar.collapsed .brand-link {
  justify-content: center;
  padding: 6px;
}
</style>

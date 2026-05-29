<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from '../components/AppSidebar.vue'

const route = useRoute()
const sidebarCollapsed = ref(false)

const isLanding = computed(() => route.path === '/')
const isSettings = computed(() => route.path === '/settings')
const isPaneRoute = computed(() =>
  route.name === 'investigate'
  || route.name === 'experts'
  || route.name === 'org-experts'
  || route.name === 'expert-results',
)
</script>

<template>
  <div class="app-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <button
      class="sidebar-toggle"
      type="button"
      :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
      @click="sidebarCollapsed = !sidebarCollapsed"
    >
      <svg v-if="sidebarCollapsed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
        <path d="M4 5h16M4 12h10M4 19h16" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
        <path d="M4 5h16M4 12h16M4 19h16" stroke-linecap="round" />
      </svg>
    </button>

    <div class="sidebar-wrap" :class="{ collapsed: sidebarCollapsed }">
      <AppSidebar :collapsed="sidebarCollapsed" />
    </div>

    <main class="main-content">
      <div class="content-scroll" :class="{ 'content-scroll--pane': isPaneRoute }">
        <div
          class="content-inner container"
          :class="{
            'container--landing': isLanding,
            'container--settings': isSettings,
            'container--pane': isPaneRoute,
          }"
        >
          <router-view />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg);
  position: relative;
}
.sidebar-wrap {
  flex-shrink: 0;
  height: 100%;
  transition: width 0.2s ease;
  width: 220px;
}
.sidebar-wrap.collapsed {
  width: 64px;
}
.main-content {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-elevated);
}
.content-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.content-scroll--pane {
  overflow: hidden;
}
.content-inner {
  min-height: 100%;
}
.content-inner.container--pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.content-inner.container--landing {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.content-inner.container--settings {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sidebar-toggle {
  position: absolute;
  top: 10px;
  left: 206px;
  z-index: 20;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, left 0.2s ease;
  -webkit-app-region: no-drag;
}
.app-layout.sidebar-collapsed .sidebar-toggle {
  left: 50px;
}
.sidebar-toggle:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.sidebar-toggle svg {
  width: 14px;
  height: 14px;
}
</style>

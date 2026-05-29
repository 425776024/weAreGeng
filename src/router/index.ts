import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../layouts/AppLayout.vue'
import LandingView from '../views/LandingView.vue'
import SchoolsView from '../views/SchoolsView.vue'
import UniversityView from '../views/UniversityView.vue'
import ResultsView from '../views/ResultsView.vue'
import ExpertsView from '../views/ExpertsView.vue'
import OrgExpertsView from '../views/OrgExpertsView.vue'
import ExpertResultsView from '../views/ExpertResultsView.vue'
import AnalyzeView from '../views/AnalyzeView.vue'
import AgentChatView from '../views/AgentChatView.vue'
import BookmarksView from '../views/BookmarksView.vue'
import InvestigateView from '../views/InvestigateView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'home', component: LandingView },
        { path: 'schools', name: 'schools', component: SchoolsView },
        { path: 'university/:id', name: 'university', component: UniversityView },
        { path: 'university/:id/results', name: 'results', component: ResultsView },
        { path: 'experts', name: 'experts', component: ExpertsView },
        { path: 'experts/org/:id', name: 'org-experts', component: OrgExpertsView },
        { path: 'experts/results', name: 'expert-results', component: ExpertResultsView },
        { path: 'analyze', name: 'analyze', component: AnalyzeView },
        { path: 'bookmarks', name: 'bookmarks', component: BookmarksView },
        { path: 'investigate', name: 'investigate', component: InvestigateView },
        { path: 'agent', name: 'agent', component: AgentChatView },
        { path: 'settings', name: 'settings', component: SettingsView },
      ],
    },
  ],
})

export default router

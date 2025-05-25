
import { createRouter, createWebHistory } from 'vue-router';
import { user, loadingUser } from '@/stores/auth'; // Import reactive user state
import { getCurrentUserSession } from '@/services/supabaseService.js'; // For initial check

// Import Views
import HomeView from '../views/HomeView.vue';
import StudentsView from '../views/StudentsView.vue';
import StudentReportView from '../views/StudentReportView.vue';
import SessionsView from '../views/SessionsView.vue';
import AttendanceView from '../views/AttendanceView.vue';
import SessionReportView from '../views/SessionReportView.vue';
import LoginView from '../views/LoginView.vue'; // New Login View

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { requiresAuth: true }
  },
  {
    path: '/students',
    name: 'students',
    component: StudentsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/students/:studentId/report',
    name: 'student-report',
    component: StudentReportView,
    props: true,
    meta: { requiresAuth: true, parentRoute: 'students' } 
  },
  {
    path: '/sessions',
    name: 'sessions',
    component: SessionsView,
    meta: { requiresAuth: true }
  },
  {
    path: '/sessions/:sessionId/report',
    name: 'session-report',
    component: SessionReportView,
    props: true,
    meta: { requiresAuth: true }
  },
  {
    path: '/attendance',
    name: 'attendance',
    component: AttendanceView,
    meta: { requiresAuth: true }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.beforeEach(async (to, from, next) => {
  if (loadingUser.value) {
    const session = await getCurrentUserSession();
    user.value = session?.user ?? null;
    loadingUser.value = false;
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = !!user.value;

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } }); 
  } else if (!requiresAuth && isAuthenticated && to.name === 'login') {
    next({ name: 'home' });
  } else {
    next();
  }
});

export default router;
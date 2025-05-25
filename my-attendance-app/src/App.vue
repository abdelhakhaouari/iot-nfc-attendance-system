<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { user, loadingUser } from '@/stores/auth';
import { onAuthStateChange as onSupabaseAuthStateChange, logout as supabaseLogout, getCurrentUserSession } from '@/services/supabaseService';

// --- Dark Mode ---
const isDarkMode = ref(false);

function applyTheme(theme) {
  const htmlElement = document.documentElement;
  if (theme === 'dark') {
    htmlElement.classList.add('dark');
    isDarkMode.value = true;
  } else {
    htmlElement.classList.remove('dark');
    isDarkMode.value = false;
  }
  try { localStorage.theme = theme; }
  catch (e) { console.error("Could not save theme to localStorage:", e); }
}

function toggleDarkMode() {
  applyTheme(isDarkMode.value ? 'light' : 'dark');
}

// --- Active Link Handling & Page Title ---
const route = useRoute();
const router = useRouter();

// --- Navigation Links ---
const navLinks = [
  { name: 'Dashboard', routeName: 'home', icon: 'fas fa-tachometer-alt' },
  { name: 'Sessions', routeName: 'sessions', icon: 'fas fa-history' },
  { name: 'Students', routeName: 'students', icon: 'fas fa-users' },
  { name: 'Scan History', routeName: 'attendance', icon: 'fas fa-clipboard-check' },
];

const currentPageTitle = computed(() => {
  if (route.name === 'login') return 'Login';
  if (route.name === 'session-report' && route.params.sessionId) return 'Session Report';
  const currentLink = navLinks.find(link => link.routeName === route.name);
  return currentLink?.name || 'Attendance System';
});

// --- Auth State ---
let authListenerSubscription = null;

onMounted(async () => {
  let initialTheme = 'light';
  try {
    const storedTheme = localStorage.theme;
    if (storedTheme === 'dark' || storedTheme === 'light') initialTheme = storedTheme;
    else initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) {
    console.warn("localStorage theme read failed, using prefers-color-scheme.");
    initialTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(initialTheme);

  if (loadingUser.value) {
    const session = await getCurrentUserSession();
    user.value = session?.user ?? null;
    loadingUser.value = false;
  }

  authListenerSubscription = onSupabaseAuthStateChange((event, session) => {
    console.log('App.vue Auth event:', event, session);
    const currentUserFromEvent = session?.user ?? null;
    user.value = currentUserFromEvent; // user.value now has user_metadata
    loadingUser.value = false;

    if (event === 'SIGNED_OUT' || (event === 'USER_DELETED' && !currentUserFromEvent)) {
      if (route.name !== 'login') router.push({ name: 'login' });
    }
  });
});

onUnmounted(() => {
  if (authListenerSubscription && authListenerSubscription.unsubscribe) {
    authListenerSubscription.unsubscribe();
  }
});

async function handleLogout() {
  try {
    await supabaseLogout();
  } catch (error) {
    console.error('Logout failed:', error);
    alert("Logout failed. Please try again.");
  }
}

// User display computed properties
const userDisplayName = computed(() => {
  // Use display_name from user_metadata if available, otherwise fallback to email
  return user.value?.user_metadata?.display_name || user.value?.email || 'User';
});

const userInitials = computed(() => {
  const name = user.value?.user_metadata?.display_name;
  if (name) {
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (user.value?.email) {
    return user.value.email.substring(0, 2).toUpperCase();
  }
  return '?';
});

</script>

<template>
  <div
    class="flex min-h-screen bg-lightBg text-lightText dark:bg-darkBg dark:text-darkText font-poppins transition-colors duration-300">

    <aside v-if="user && !loadingUser"
      class="w-64 h-screen bg-lightSurface dark:bg-darkSurface shadow-lg fixed left-0 top-0 bottom-0 z-40 flex flex-col border-r border-gray-200 dark:border-darkBorder">
      <div class="px-6 py-5 border-b border-gray-200 dark:border-darkBorder flex items-center space-x-3 flex-shrink-0">
        <div
          class="h-8 w-8 bg-primary dark:bg-darkAccent rounded-lg flex items-center justify-center text-white dark:text-darkBg">
          <i class="fas fa-clipboard-check text-lg"></i>
        </div>
        <h2 class="text-xl font-semibold text-primary dark:text-darkAccent">Attendance</h2>
      </div>

      <nav class="flex-1 mt-6 space-y-2 px-3 overflow-y-auto">
        <RouterLink v-for="link in navLinks" :key="link.routeName" :to="{ name: link.routeName }"
          class="sidebar-link group"
          :class="{ 'sidebar-link-active': route.name === link.routeName || (route.meta.parentRoute === link.routeName) }">
          <i :class="[link.icon, 'w-5 mr-3 text-center group-hover:scale-110 transition-transform']"></i>
          <span>{{ link.name }}</span>
        </RouterLink>
      </nav>

      <div class="px-6 py-4 mt-auto border-t border-gray-200 dark:border-darkBorder flex-shrink-0">
        <div class="flex items-center mb-3">
          <div
            class="h-10 w-10 rounded-full mr-3 border-2 border-primary dark:border-darkAccent bg-primary/20 dark:bg-darkAccent/20 flex items-center justify-center text-primary dark:text-darkAccent font-semibold shrink-0">
            {{ userInitials }}
          </div>
          <div class="min-w-0"> <!-- Added min-w-0 for truncation to work with flex -->
            <p class="text-sm font-medium text-lightText dark:text-darkText truncate" :title="userDisplayName">
              {{ userDisplayName }}
            </p>
            <p class="text-xs text-lightTextSecondary dark:text-darkTextSecondary truncate">
              Professor
            </p>
          </div>
        </div>
        <button @click="handleLogout"
          class="flex items-center w-full px-4 py-2 text-sm text-danger rounded-md hover:bg-red-50 dark:hover:bg-danger/10 transition-colors duration-200 group">
          <i class="fas fa-sign-out-alt w-5 mr-3 text-center group-hover:translate-x-0.5 transition-transform"></i>
          Logout
        </button>
      </div>
    </aside>

    <div class="flex-1 w-[calc(100vw-256px)] flex flex-col" :class="{ 'md:ml-64': user && !loadingUser }">
      <header  v-if="user && !loadingUser"
        class="sticky top-0 z-30  bg-lightSurface/80 dark:bg-darkSurface/80 backdrop-blur-md shadow-sm dark:shadow-md-dark border-b border-gray-200 dark:border-darkBorder">
        <div class="flex items-center justify-between px-4 sm:px-6 h-16">
          <div>
            <h1 class="text-lg font-semibold text-lightText dark:text-darkText">
              {{ currentPageTitle }}
            </h1>
          </div>
          <div class="flex  items-center space-x-3 sm:space-x-4">
            <div class="flex items-center space-x-2 text-sm text-lightTextSecondary dark:text-darkTextSecondary md:flex"
              title="NFC Reader Status (Simulated)">
              <i class="fas fa-wifi text-green-500 animate-pulse-subtle"></i>
              <span>Reader Online</span>
            </div>
            <button @click="toggleDarkMode" aria-label="Toggle Dark Mode" class="icon-button">
              <i class="fas fa-sun" v-if="!isDarkMode"></i>
              <i class="fas fa-moon" v-else></i>
            </button>
            <button aria-label="Notifications" class="icon-button relative">
              <i class="fas fa-bell"></i>
              <span
                class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger animate-ping-slow opacity-75"></span>
              <span class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger"></span>
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1  p-4 sm:p-6 md:p-8 overflow-y-auto bg-gray-100 dark:bg-darkBg">
        <div v-if="loadingUser" class="flex justify-center items-center h-full pt-16">
          <i class="fas fa-spinner fa-spin text-4xl text-primary dark:text-darkAccent"></i>
          <span class="ml-3 text-lg">Initializing App...</span>
        </div>
        <RouterView v-else v-slot="{ Component, route: currentRoute }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" :key="currentRoute.fullPath" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.sidebar-link {
  @apply flex items-center px-4 py-2.5 text-lightTextSecondary dark:text-darkTextSecondary rounded-md hover:bg-gray-100 dark:hover:bg-darkSurfaceLighter hover:text-primary dark:hover:text-darkAccent transition-colors duration-200 relative;
  font-size: 0.9rem;
}

.sidebar-link-active {
  @apply bg-primary/10 text-primary dark:bg-darkAccent/15 dark:text-darkAccent font-medium;
}

.sidebar-link-active::after {
  content: '';
  position: absolute;
  right: 0;
  top: 25%;
  bottom: 25%;
  width: 3px;
  @apply bg-primary dark:bg-darkAccent rounded-l-sm;
}

.icon-button {
  @apply flex items-center justify-center h-9 w-9 rounded-full text-lightTextSecondary dark:text-darkTextSecondary hover:bg-gray-200 dark:hover:bg-darkSurfaceLighter transition-colors;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes pulse-subtle {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes ping-slow {

  75%,
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.animate-ping-slow {
  animation: ping-slow 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}
</style>
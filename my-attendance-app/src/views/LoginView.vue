<template>
    <div class="flex items-center justify-center min-h-screen px-4">
        <div class="w-full max-w-md p-8 space-y-6 bg-lightSurface dark:bg-darkSurface rounded-xl shadow-xl">
            <div class="text-center">
                <i class="fas fa-user-shield text-5xl text-primary dark:text-darkAccent mb-4"></i>
                <h1 class="text-3xl font-bold text-lightText dark:text-darkText">Login</h1>
                <p class="text-lightTextSecondary dark:text-darkTextSecondary mt-1">Access your attendance dashboard.
                </p>
            </div>

            <form @submit.prevent="handleLogin" class="space-y-6">
                <div>
                    <label for="email" class="form-label">Email address</label>
                    <input id="email" v-model="email" type="email" autocomplete="email" required class="input-field"
                        placeholder="you@Attendance.app">
                </div>

                <div>
                    <label for="password" class="form-label">Password</label>
                    <div class="relative">
                        <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'"
                            autocomplete="current-password" required class="input-field pr-10" placeholder="••••••••">
                        <button type="button" @click="toggleShowPassword"
                            class="absolute inset-y-0 right-0 px-3 flex items-center text-sm leading-5 text-lightTextSecondary dark:text-darkTextSecondary hover:text-lightText dark:hover:text-darkText"
                            aria-label="Toggle password visibility">
                            <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                        </button>
                    </div>
                </div>

                <div v-if="errorMsg" class="error-banner text-sm py-2" role="alert">
                    <div>
                        <p>{{ errorMsg }}</p>
                    </div>
                </div>

                <div>
                    <button type="submit" :disabled="isLoading" class="button-primary w-full py-3 text-base"
                        :class="{ 'opacity-50 cursor-wait': isLoading }">
                        <i v-if="isLoading" class="fas fa-spinner fa-spin mr-2"></i>
                        {{ isLoading ? 'Signing in...' : 'Sign in' }}
                    </button>
                </div>
            </form>
            <p class="text-xs text-center text-lightTextSecondary dark:text-darkTextSecondary">
                Use the demo credentials provided.
            </p>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { loginWithPassword } from '@/services/supabaseService';

const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const isLoading = ref(false);
const errorMsg = ref('');
const showPassword = ref(false); 

async function handleLogin() {
    isLoading.value = true;
    errorMsg.value = '';
    try {
        await loginWithPassword(email.value, password.value);
        const redirectPath = route.query.redirect || '/';
        router.push(redirectPath);
    } catch (error) {
        console.error('Login failed:', error);
        errorMsg.value = error.message || 'Invalid email or password.';
    } finally {
        isLoading.value = false;
    }
}

function toggleShowPassword() {
    showPassword.value = !showPassword.value;
}
</script>

<style lang="postcss" scoped>
.form-label {
    @apply block text-sm font-medium text-lightTextSecondary dark:text-darkTextSecondary mb-1;
}

.input-field {
    @apply w-full px-4 py-2.5 border border-gray-300 dark:border-darkBorder rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary dark:bg-darkSurfaceLighter dark:text-darkText dark:focus:ring-darkAccent dark:focus:border-darkAccent;
}

.button-primary {
    @apply flex items-center justify-center bg-primary hover:opacity-90 text-white font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed;
}

.error-banner {
    @apply bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300 px-3 py-2 rounded-md text-center;
}
</style>
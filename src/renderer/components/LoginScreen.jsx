import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';

export default function LoginScreen() {
  const status = useAuthStore((s) => s.status);
  const loginError = useAuthStore((s) => s.loginError);
  const login = useAuthStore((s) => s.login);
  const isLoading = status === 'loading';

  return (
    <div className="flex flex-col items-center justify-center h-screen px-10 drag select-none">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        className="flex flex-col items-center"
      >
        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-5">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
            <path
              d="M8 16l5.5 5.5L24 11"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-ink mb-1">mTasks</h1>
        <p className="text-sm text-muted mb-8">Your tasks, one click away.</p>

        <button
          onClick={login}
          disabled={isLoading}
          className="no-drag bg-accent hover:bg-accent/90 active:scale-[0.98] text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M14.537 6.727H14V6.7H8v2.6h3.766A3.9 3.9 0 014.1 8a3.9 3.9 0 013.9-3.9c.983 0 1.877.37 2.562.972l1.838-1.838A6.484 6.484 0 008 1.5 6.5 6.5 0 108 14.5a6.5 6.5 0 006.537-7.773z" fill="currentColor" fillOpacity="0.9" />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        {loginError && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-danger mt-3 text-center max-w-[240px]"
          >
            {loginError}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

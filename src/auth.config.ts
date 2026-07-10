import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [],
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.tenant_id = (user as any).tenant_id;
        token.tenant_status = (user as any).tenant_status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id || token.sub) as string;
        (session.user as any).role = token.role;
        (session.user as any).tenant_id = token.tenant_id;
        (session.user as any).tenant_status = token.tenant_status;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnOnboarding = nextUrl.pathname.startsWith('/onboarding');
      
      // If trying to access protected routes without being logged in
      if ((isOnDashboard || isOnOnboarding) && !isLoggedIn) {
        return false; // Redirects to login
      }

      if (isLoggedIn) {
        const tenantStatus = (auth.user as any).tenant_status;

        // We let users visit /auth pages even if logged in, so they can switch accounts or reset passwords.

        // If they are on Dashboard but haven't finished onboarding
        if (isOnDashboard && tenantStatus !== 'ACTIVE') {
          return Response.redirect(new URL('/onboarding/create-store', nextUrl));
        }

        // If they are on Onboarding but ALREADY finished onboarding
        if (isOnOnboarding && tenantStatus === 'ACTIVE') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

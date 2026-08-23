import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  providers: [],
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions || [];
        token.tenant_id = (user as any).tenant_id;
        token.tenant_status = (user as any).tenant_status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id || token.sub) as string;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions || [];
        (session.user as any).tenant_id = token.tenant_id;
        (session.user as any).tenant_status = token.tenant_status;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isOnDashboard = pathname.startsWith('/dashboard');
      const isOnOnboarding = pathname.startsWith('/onboarding');
      const isOnPos = pathname.startsWith('/pos');
      const isOnAccount = pathname.startsWith('/account');
      
      // If trying to access protected routes without being logged in
      if ((isOnDashboard || isOnOnboarding || isOnPos || isOnAccount) && !isLoggedIn) {
        return false; // Redirects to login
      }

      if (isLoggedIn) {
        const tenantStatus = (auth.user as any).tenant_status;
        const role = (auth.user as any).role;
        const permissions = (auth.user as any).permissions || [];
        
        const hasPermission = (module: string, action: string) => {
          if (role === 'OWNER') return true;
          return permissions.some((p: any) => p.module === module && p.action === action);
        };

        // Enforce onboarding check
        if ((isOnDashboard || isOnPos || isOnAccount) && tenantStatus !== 'ACTIVE') {
          return Response.redirect(new URL('/onboarding/create-store', nextUrl));
        }

        if (isOnOnboarding && tenantStatus === 'ACTIVE') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // --- Role-Based Access Control ---
        
        // POS Cashier restriction
        if (isOnDashboard && role === 'CASHIER') {
          return Response.redirect(new URL('/pos/sell', nextUrl));
        }

        // Account Module protections
        if (isOnAccount) {
          if (pathname.startsWith('/account/users') && !hasPermission('USERS', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
          if (pathname.startsWith('/account/permissions') && !hasPermission('ROLES', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
          if (
            (pathname.startsWith('/account/subscription') ||
             pathname.startsWith('/account/billing') ||
             pathname.startsWith('/account/activity')) && 
             !hasPermission('SETTINGS', 'VIEW')
          ) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
        }

        // Dashboard Module protections
        if (isOnDashboard) {
          if (pathname === '/dashboard' && !hasPermission('REPORTS', 'VIEW')) {
            if (hasPermission('SALES', 'CREATE')) return Response.redirect(new URL('/pos/sell', nextUrl));
            if (hasPermission('PRODUCTS', 'VIEW')) return Response.redirect(new URL('/dashboard/products', nextUrl));
            if (hasPermission('INVENTORY', 'VIEW')) return Response.redirect(new URL('/dashboard/inventory/stock-list', nextUrl));
            return Response.redirect(new URL('/account/profile', nextUrl));
          }
          if (pathname.startsWith('/dashboard/products') && !hasPermission('PRODUCTS', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
          if (pathname.startsWith('/dashboard/inventory') && !hasPermission('INVENTORY', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
          if (pathname.startsWith('/dashboard/reports') && !hasPermission('REPORTS', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
          if (pathname.startsWith('/dashboard/suppliers') && !hasPermission('PRODUCTS', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
        }

        // POS Module protections
        if (isOnPos) {
          if (!hasPermission('SALES', 'CREATE') && !hasPermission('SALES', 'VIEW')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
        }
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

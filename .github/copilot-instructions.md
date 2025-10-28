# Start Testing - GitHub Copilot Instructions

**ALWAYS follow these instructions first.** Only fallback to additional search and context gathering if the information here is incomplete or found to be in error.

## Project Overview
Next.js-based accessibility auditing and bug tracking platform for project management with role-based access control. Multi-tenant SaaS with **Administrator**, **Contractor**, and **Client** roles.

**⚠️ ACCESSIBILITY PRIORITY: This platform audits WCAG compliance - ALL code must meet WCAG 2.2 AA standards. No exceptions.**

## Architecture & Key Components

### Technology Stack
- **Next.js 15.4.6** with TypeScript and App Router
- **Auth0** for authentication with PostgreSQL user sync
- **Tailwind CSS v4** for styling with accessibility-first design
- **Heroicons** for accessible iconography
- **PostgreSQL** for data persistence
- **Vercel** deployment with Heroku Postgres (production)

### Database Structure
- **Users table** syncs with Auth0 (`src/lib/syncUser.ts`)
- **Role-based permissions**: Admin (full access), Contractor (assigned tasks), Client (read-only)
- **Project hierarchy**: Clients → Projects → Issues → Milestones
- **WCAG Standards tracking**: Standards → Criteria → Violation tracking

### Authentication & User Management
- **Auth0 integration** via `@auth0/nextjs-auth0` (`src/lib/auth0.ts`)
- **Automatic user sync** to PostgreSQL on first login
- **Session management** with 7-day rolling sessions
- **Role assignment** and permission-based routing

## Critical Development Workflows

### WCAG Compliance Requirements
**MANDATORY for all code changes:**
- **Semantic HTML**: Use proper heading hierarchy (h1→h2→h3), landmarks (`main`, `nav`, `section`)
- **ARIA Support**: Add `aria-label`, `aria-describedby`, `role` attributes where needed
- **Color Contrast**: All text must meet 4.5:1+ ratio (verify with accessibility tools)
- **Keyboard Navigation**: All interactive elements must be keyboard accessible with visible focus
- **Screen Reader**: Include descriptive text, proper alt attributes, and screen reader context
- **Focus Management**: Logical tab order, focus trapping in modals, focus restoration

### Bootstrap and Build Workflow (VALIDATED)
**NEVER CANCEL THESE COMMANDS** - they take time but must complete:

```bash
# Install dependencies (takes ~30 seconds)
npm install

# Start development server (takes ~2 seconds)
npm run dev
# ✅ Serves at http://localhost:3000 (or next available port)

# Build for production (takes ~25 seconds, REQUIRES ENV VARS)
npm run build
# ⚠️ NEVER CANCEL: Set timeout to 90+ seconds
# ❌ FAILS without proper environment variables

# Run production server (after build)
npm start
# ✅ Serves production build

# Lint code (takes ~5 seconds)
npm run lint
# ⚠️ Shows many ESLint errors that need manual fixing
```

### Environment Setup (CRITICAL)
**Build WILL FAIL without these environment variables:**

Create `.env.local` in repository root:
```bash
# REQUIRED for build to succeed
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SECRET=your-session-secret-minimum-32-chars
APP_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://user:password@host:port/database

# Optional (for email features)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@yourdomain.com
```

**Verified Setup Commands:**
```bash
# Copy example environment file (both are empty - create manually)
touch .env.local
# Edit .env.local with real values from AUTH0_SETUP.md
```

### Database Setup (VALIDATED)
**WARNING: Database scripts require working PostgreSQL connection**

The DATABASE_SCRIPTS.md documentation mentions npm scripts that **DO NOT EXIST** in package.json. Run scripts directly:

```bash
# Database setup scripts (run with node directly)
node setup-db.js                    # Basic database setup
node setup-db-complete.js           # Full schema setup
node check-db.js                    # Check database status
node migrate-db.js                  # Run migrations
node seed-standards.js              # Seed WCAG standards
node create-updatable-view.js       # Create view screens fix

# All scripts require DATABASE_URL environment variable
# All scripts fail with ECONNREFUSED if database is not accessible
```

**Database Script Timing:**
- **setup-db.js**: ~2-10 seconds (depending on database state)
- **setup-db-complete.js**: ~30-120 seconds for full schema
- **NEVER CANCEL**: Database operations must complete to avoid corruption

### Code Quality & Validation (VALIDATED)
```bash
# TypeScript type checking (takes ~7 seconds)
npx tsc --noEmit
# ✅ Currently passes with no errors

# ESLint with auto-fix (takes ~5-30 seconds)
npx eslint src/ --fix
# ⚠️ Many issues remain that need manual fixing
# ⚠️ Avoid linting .next directory (build artifacts)

# Format code (no formatter currently configured)
# Consider adding prettier for consistent formatting
```

### API Health Checking (VALIDATED)
Test application health with dev server running:
```bash
# Start dev server first
npm run dev

# Test API endpoints
curl http://localhost:3000/api/email/health      # Email configuration status
curl http://localhost:3000/api/auth0/health      # Auth0 configuration status  
curl http://localhost:3000/api/auth/test         # Auth environment variables
curl http://localhost:3000/api/db/health         # Database connectivity (if configured)
```

### Manual Validation Required (CRITICAL)
**ALWAYS test these scenarios after making changes:**

1. **Build and Start Validation:**
   ```bash
   # Complete build test (takes ~25 seconds total)
   npm run build && npm start
   # ✅ Must serve content at http://localhost:3000
   # ✅ Homepage must render with "Welcome to Start Testing"
   # ✅ Navigation sidebar must be visible
   # ✅ Sign In button must be present
   ```

2. **Development Server Test:**
   ```bash
   npm run dev
   # ✅ Must start within 5 seconds
   # ✅ Must auto-reload on file changes
   # ✅ Must show proper TypeScript/ESLint errors in console
   ```

3. **Authentication Flow Test:**
   ```bash
   # With proper AUTH0 credentials in .env.local
   # 1. Click "Sign In" button
   # 2. Should redirect to Auth0 login
   # 3. After login, should return to dashboard
   # ⚠️ Requires real Auth0 application setup
   ```

4. **WCAG Compliance Validation:**
   - **Keyboard Navigation**: Tab through all interactive elements
   - **Screen Reader**: Test with NVDA/JAWS if available  
   - **Color Contrast**: Verify 4.5:1+ ratios with tools
   - **Focus Indicators**: Visible focus on all interactive elements
   - **Semantic HTML**: Proper heading hierarchy and landmarks

## Component Development Patterns

#### Layout & Navigation
```tsx
// Always use semantic HTML structure
<main id="main-content" role="main" className="p-4">
  <h1>Page Title</h1>  {/* Proper heading hierarchy */}
  {children}
</main>

// Navigation with accessibility
<nav aria-label="Primary" className="...">
  <Link 
    href="/dashboard"
    className="focus:outline-none focus-visible:ring-2"
    aria-current={active ? "page" : undefined}
  >
    Dashboard
  </Link>
</nav>
```

#### Form Patterns with WCAG Compliance
```tsx
<form onSubmit={handleSubmit} noValidate>
  <div className="mb-3">
    <label htmlFor="email" className="block text-sm font-medium">
      Email Address
      <span aria-label="required" className="text-red-500">*</span>
    </label>
    <input
      id="email"
      type="email"
      required
      aria-describedby="email-error"
      className="focus:ring-2 focus:ring-indigo-500"
    />
    {errors.email && (
      <div id="email-error" role="alert" className="text-red-600 text-sm">
        {errors.email}
      </div>
    )}
  </div>
  
  <button 
    type="submit"
    className="focus:outline-none focus-visible:ring-2"
  >
    Submit Form
  </button>
</form>
```

#### Modal Development with Accessibility
```tsx
// Modal component with focus management
const Modal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
      tabIndex={-1}
      className="fixed inset-0 z-50"
    >
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg">
        <h2 id="modal-title" className="text-lg font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};
```

### API Route Patterns

#### Auth0 Integration
```typescript
// API route with Auth0 protection
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';

export default withApiAuthRequired(async function handler(req, res) {
  const session = await getSession(req, res);
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Sync user to database
  const user = await syncUserToDatabase(session.user);
  
  res.json({ user });
});
```

#### Database Operations
```typescript
// Database query with error handling
import { db } from '@/lib/db';

export async function getProjects(userId: string) {
  try {
    const result = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch projects');
  }
}
```

### Custom Hooks & Utilities
```typescript
// User authentication hook (src/hooks/useUser.ts)
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/profile');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else if (response.status === 401) {
          setUser(null); // User not authenticated
        } else {
          throw new Error('Failed to fetch user');
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, []);

  return { user, isLoading, error };
}

// Higher-order component for authentication
export function withAuth<P extends object>(WrappedComponent: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { user, isLoading } = useUser();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" aria-hidden="true" />
          <span className="sr-only">Loading user information...</span>
        </div>
      );
    }
    
    if (!user) {
      return (
        <div className="text-center py-10">
          <h2>Authentication Required</h2>
          <a href="/api/auth/login" className="btn btn-primary">
            Sign In
          </a>
        </div>
      );
    }
    
    return <WrappedComponent {...props} user={user} />;
  };
}
```

### File Structure & Organization
```
src/
├── app/                          # Next.js 15 App Router
│   ├── api/                     # API routes
│   │   ├── auth/               # Auth0 authentication endpoints
│   │   ├── dashboard/          # Dashboard API endpoints
│   │   └── user/               # User management endpoints
│   ├── dashboard/              # Dashboard pages
│   ├── profile/                # User profile pages
│   ├── layout.tsx              # Root layout with accessibility structure
│   ├── page.tsx                # Homepage
│   └── globals.css             # Tailwind CSS imports
├── components/                  # Reusable UI components
│   ├── Sidebar.tsx             # Main navigation with accessibility
│   ├── Header.tsx              # Top header with mobile nav
│   ├── UserMenu.tsx            # Dropdown with focus management
│   └── dashboard/              # Dashboard-specific components
├── hooks/                       # Custom React hooks
│   ├── useUser.ts              # User authentication state
│   └── useUserRole.ts          # Role-based permissions
├── lib/                        # Utility libraries
│   ├── auth0.ts                # Auth0 configuration
│   ├── db.ts                   # PostgreSQL connection
│   └── syncUser.ts             # User synchronization
└── types/                      # TypeScript type definitions
    └── auth0.d.ts              # Auth0 type extensions
```

### Import Patterns
```typescript
// Use absolute imports with @ alias
import { useUser } from '@/hooks/useUser';
import Header from '@/components/Header';
import { db } from '@/lib/db';

// Heroicons with accessibility
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';

// Next.js components
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

// Auth0
import { useUser as useAuth0User } from '@auth0/nextjs-auth0/client';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
```

## Project-Specific Conventions

### Component Architecture
- **Shared components** in `src/components/` (Sidebar, Header, UserMenu)
- **Page-specific components** in `src/components/dashboard/`
- **Accessibility-first**: All components include ARIA labels and keyboard support
- **TypeScript strict mode**: All components properly typed

### Styling Patterns
```css
/* Tailwind CSS v4 with accessibility focus */
@import "tailwindcss";

/* Focus ring utilities for accessibility */
.focus-ring {
  @apply focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400;
}

/* Screen reader only text */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
}
```

### Role-Based Access Control
```typescript
// Check user permissions
export function hasAdminAccess(user: User): boolean {
  return user.role === 'admin';
}

export function canAccessProject(user: User, projectId: string): boolean {
  return user.role === 'admin' || user.assignedProjects.includes(projectId);
}

// Protect routes based on roles
export function withAuth(WrappedComponent: React.ComponentType) {
  return function AuthenticatedComponent(props: any) {
    const { user, isLoading } = useUser();
    
    if (isLoading) return <div>Loading...</div>;
    if (!user) return <LoginPrompt />;
    
    return <WrappedComponent {...props} user={user} />;
  };
}
```

### Error Handling & Validation
```typescript
// Client-side form validation
const schema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

// API error responses
export function createErrorResponse(message: string, status: number = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Build & Deployment Workflows

### Development Setup
```bash
# Clone and setup
git clone https://github.com/Techopolis-Online/Start-Testing.git
cd Start-Testing
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Auth0 credentials (see AUTH0_SETUP.md)

# Setup PostgreSQL database
node setup-db.js

# Run development server
npm run dev
# Access at http://localhost:3000
```

### Environment Variables Required
```bash
# Auth0 Configuration (see AUTH0_SETUP.md)
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SECRET=your-long-random-secret
APP_BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/start_testing

# Optional
NODE_ENV=development
```

### Code Quality & Linting
```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npx eslint . --fix

# Type checking
npx tsc --noEmit
```

### Common ESLint Issues to Fix
- Use `Link` component for internal navigation (not `<a>` tags for `/dashboard`, `/profile` etc.)
- **Exception**: Auth0 routes (`/api/auth/login`, `/api/auth/logout`) should use `<a>` tags
- Avoid `any` types - use proper TypeScript interfaces
- Remove unused variables and imports
- Ensure all async functions handle errors properly

### Database Setup & Migrations
```sql
-- Users table for Auth0 sync (database_setup.sql)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    auth0_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'client',
    profile_picture TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Testing
Currently no test framework is configured. For future testing setup, consider:
- **Jest + React Testing Library** for component testing
- **Playwright** for end-to-end accessibility testing
- **axe-core** for automated accessibility testing
- **Manual testing** with screen readers (JAWS, NVDA, VoiceOver)

```bash
# Manual accessibility testing workflow
1. Test with keyboard navigation only
2. Test with screen reader
3. Use axe DevTools browser extension
4. Verify color contrast with tools
5. Test responsive design on mobile devices
```

## WCAG Compliance Testing & Validation

### Required Testing Tools
- **JAWS/NVDA**: Screen reader testing
- **axe DevTools**: Automated accessibility scanning
- **WAVE**: Web accessibility evaluation
- **Lighthouse**: Accessibility audit in Chrome DevTools
- **Color Oracle**: Color blindness simulation

### Accessibility Validation Checklist
**Before committing any frontend changes:**
1. **Screen Reader Test**: Navigate with JAWS/NVDA, ensure all content is announced
2. **Keyboard Navigation**: Tab through all elements, verify focus indicators
3. **Color Contrast**: Ensure 4.5:1+ ratios for normal text, 3:1+ for large text
4. **Semantic HTML**: Validate proper heading hierarchy and landmarks
5. **ARIA Labels**: Check all interactive elements have accessible names
6. **Responsive Design**: Test on mobile devices with screen readers

### Accessibility Component Examples
```tsx
// Skip link for keyboard users (add to layout)
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-2 z-50"
>
  Skip to main content
</a>

// Accessible dropdown menu (see UserMenu.tsx)
const UserMenu = () => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useMemo(() => `user-menu-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        className="focus:outline-none focus-visible:ring-2"
        onClick={() => setOpen(!open)}
      >
        <UserIcon className="h-6 w-6" aria-hidden="true" />
        <span className="sr-only">User menu</span>
      </button>
      
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 mt-2 bg-white rounded-md shadow-lg"
        >
          <Link 
            href="/profile" 
            role="menuitem"
            className="block px-4 py-2 focus:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
        </div>
      )}
    </div>
  );
};

// Mobile navigation with focus management (see Header.tsx)
const MobileNav = ({ mobileOpen, setMobileOpen }) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (mobileOpen) {
      // Focus management and screen reader announcement
      closeBtnRef.current?.focus();
      const live = document.createElement("div");
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      live.className = "sr-only";
      live.textContent = "Navigation sidebar opened. Press Escape to close.";
      document.body.appendChild(live);
      
      // Cleanup
      return () => {
        if (document.body.contains(live)) document.body.removeChild(live);
      };
    }
  }, [mobileOpen]);
  
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
      <nav aria-label="Mobile" className="absolute left-0 inset-y-0 w-72">
        <button
          ref={closeBtnRef}
          aria-label="Close navigation sidebar"
          onClick={() => setMobileOpen(false)}
        >
          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
        </button>
        {/* Navigation items */}
      </nav>
    </div>
  );
};

// Accessible data table
<table role="table" aria-label="Project issues">
  <caption className="sr-only">
    List of {issues.length} issues for project {projectName}
  </caption>
  <thead>
    <tr>
      <th scope="col">Issue Title</th>
      <th scope="col">Status</th>
      <th scope="col">Priority</th>
    </tr>
  </thead>
  <tbody>
    {issues.map(issue => (
      <tr key={issue.id}>
        <td>{issue.title}</td>
        <td>
          <span 
            className={`badge ${getStatusColor(issue.status)}`}
            aria-label={`Status: ${issue.status}`}
          >
            {issue.status}
          </span>
        </td>
        <td>{issue.priority}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### Performance & SEO Considerations
- **Next.js Image component** for optimized images with proper alt text
- **Metadata API** for proper page titles and descriptions
- **Server-side rendering** for better initial load performance
- **Font optimization** with `next/font`

## Common Issues & Solutions (VALIDATED)

### Build Errors
- **"DATABASE_URL is required" error**: 
  ```bash
  # Add to .env.local file:
  DATABASE_URL=postgresql://user:pass@host:port/database
  ```
- **Environment variable missing**: Build fails if AUTH0_* variables not set
- **Port 3000 in use**: Dev server automatically uses next available port (3001, 3002, etc.)
- **TypeScript/ESLint errors**: Currently disabled in next.config.ts for builds

### Database Issues  
- **ECONNREFUSED errors**: All database scripts require working PostgreSQL connection
- **npm scripts not found**: DATABASE_SCRIPTS.md mentions scripts that don't exist in package.json
  ```bash
  # Use direct node commands instead:
  node setup-db.js
  node check-db.js
  ```
- **Database script timeouts**: NEVER CANCEL - set 60+ minute timeouts for complete setup

### Development Issues
- **ESLint errors**: 81 problems found (65 errors, 16 warnings) - need manual fixes
  - Many `any` types need proper TypeScript interfaces
  - `<a>` tags for Auth0 routes should use Link components
  - Missing React hook dependencies
- **No test framework**: Currently no Jest, Playwright, or testing setup
- **Build artifacts**: Avoid linting .next directory

### Authentication Issues (VALIDATED)
- **Auth0 health check fails**: `/api/auth0/health` returns `"missing-config"` without proper environment
- **Session issues**: Requires AUTH0_SECRET minimum 32 characters
- **Callback URL mismatch**: Verify Auth0 application settings match AUTH0_SETUP.md

### Performance & Validation
- **Manual validation required**: No automated testing - must manually verify all changes
- **Accessibility validation**: Test with keyboard navigation and screen readers
- **Health endpoints work**: Use `/api/email/health`, `/api/auth0/health` for debugging

## Critical Reminders

### NEVER CANCEL Commands
- **npm run build**: Takes ~25 seconds, set 90+ second timeout
- **Database setup scripts**: Can take 30-120 seconds, set 180+ second timeout  
- **npm install**: Takes ~30 seconds, set 60+ second timeout

### Always Test After Changes
1. **Build test**: `npm run build && npm start`
2. **Development test**: `npm run dev` 
3. **Manual functionality**: Click through UI, test keyboard navigation
4. **WCAG compliance**: Verify accessibility standards
5. **Health endpoints**: Confirm API functionality

### Required Environment Setup
```bash
# Minimum viable .env.local for development:
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id  
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SECRET=minimum-32-character-secret
APP_BASE_URL=http://localhost:3000
DATABASE_URL=postgresql://user:pass@host:port/db
```

**Follow these instructions first. Search or explore only when information here is incomplete or incorrect.**

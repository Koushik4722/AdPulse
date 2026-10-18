import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import App from './App';
import './styles.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const root = createRoot(document.getElementById('root'));

if (!publishableKey) {
  root.render(<div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div className="card max-w-xl"><h1 className="text-xl font-bold">Clerk setup needed</h1><p className="mt-3 text-slate-600">Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to the client environment and redeploy.</p></div></div>);
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider
        publishableKey={publishableKey}
        signInUrl="/login"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/onboarding"
      >
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider><App /></SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ClerkProvider>
    </React.StrictMode>
  );
}

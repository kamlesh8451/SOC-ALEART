import React from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { Toaster } from 'sonner';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      {isAuthenticated ? <DashboardView /> : <LoginView />}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

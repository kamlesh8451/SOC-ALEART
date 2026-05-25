import React from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { Toaster } from 'sonner';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();

  return (
    <>
      <Toaster 
        position="top-right" 
        theme={theme === 'light' ? 'light' : 'dark'} 
        richColors 
      />
      {isAuthenticated ? <DashboardView /> : <LoginView />}
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'cyber' | 'light' | 'glitch' | 'midnight' | 'ocean';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('gsoc_theme') as Theme;
    return saved || 'cyber';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('gsoc_theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    
    // Smooth transition for theme change
    document.documentElement.classList.add('theme-transition');
    const timer = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 500);
    
    return () => clearTimeout(timer);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

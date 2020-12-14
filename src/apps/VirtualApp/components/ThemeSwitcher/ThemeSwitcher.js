import React, { useState } from 'react';
import { ThemeProvider } from '@material-ui/core/styles';

import dark from './dark';
import light from './light';

export const ThemeContext = React.createContext({});

const ThemeSwitcher = ({ children }) => {
  const [name, setThemeName] = useState('light');

  const toggleTheme = () => (name === 'dark') ? setThemeName('light') : setThemeName('dark');

  return (
    <ThemeContext.Provider value={{ isDark: name === 'dark', toggleTheme }}>
      <ThemeProvider theme={name === 'dark' ? dark : light}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );

};

export default ThemeSwitcher;

import React, {useState} from "react";
import {ThemeProvider, StyledEngineProvider} from "@mui/material/styles";

import dark from "./dark";
import light from "./light";

export const ThemeContext = React.createContext({});

const ThemeSwitcher = ({children}) => {
  const [name, setThemeName] = useState(localStorage.getItem("themeName") || "light");

  const toggleTheme = () => {
    const n = name === "dark" ? "light" : "dark";
    localStorage.setItem("themeName", n);
    setThemeName(n);
  };

  return (
    <ThemeContext.Provider value={{isDark: name === "dark", toggleTheme}}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={name === "dark" ? dark : light}>{children}</ThemeProvider>
      </StyledEngineProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeSwitcher;

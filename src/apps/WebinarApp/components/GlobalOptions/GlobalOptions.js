import React, {useState} from "react";

export const GlobalOptionsContext = React.createContext({});

const GlobalOptions = ({children}) => {
  const [hideSelf, setHideSelf] = useState(false);

  const toggleHideSelf = () => setHideSelf(!hideSelf);

  return (
    <GlobalOptionsContext.Provider value={{hideSelf, toggleHideSelf}}>
      {children}
    </GlobalOptionsContext.Provider>
  );
};

export default GlobalOptions;

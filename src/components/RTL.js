// the RTL component in separate rtl.jsx file
import React from "react";
import createCache from "@emotion/cache";
import {CacheProvider} from "@emotion/react";

export const muiCache = createCache({
  key: "mui",
  prepend: true,
});

export default (props) => <CacheProvider value={muiCache}>{props.children}</CacheProvider>;

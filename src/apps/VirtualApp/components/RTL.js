// the RTL component in separate rtl.jsx file
import React from 'react';
import { create } from 'jss';
import rtl from 'jss-rtl';
import { StylesProvider, jssPreset } from '@material-ui/core/styles';

const jss = create({ plugins: [...jssPreset().plugins, rtl()] });

export default props => (
  <StylesProvider jss={jss}>
    {props.children}
  </StylesProvider>
);

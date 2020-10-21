import React, { useEffect, useState } from 'react';
import Box from '@material-ui/core/Box';
import { List, ListItem, MenuItem, TextField } from '@material-ui/core';
import { getLanguage } from '../../../i18n/i18n';

const mapOption = key => {
  return (
    <MenuItem key={key} value={key} button>
      {key}
    </MenuItem>
  );
};

const fetchLanguages = async (id) => {
  const url = `https://kabbalahmedia.info/assets/sources/${id}/index.json`;
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.json();
  } catch (e) {
    return null;
  }
};

const fetchDoc = async (id, file) => {
  const url = `https://kabbalahmedia.info/assets/sources/${id}/${file}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.text();
  } catch (e) {
    return null;
  }
};

let linkByLand;

const LoadSourceContainer = ({ id = 'hFeGidcS' }) => {
  const [data, setData]         = useState([]);
  const [selected, setSelected] = useState(getLanguage());
  const [html, setHtml]         = useState();

  const setLanguageData = async () => {
    const json = await fetchLanguages(id);
    if (!json)
      return;

    linkByLand = json;
    const keys = Object.keys(json);

    let defaultLang = getLanguage();
    defaultLang     = !json[defaultLang] ? keys[0] : defaultLang;
    handleLanguageSelect({ target: { value: defaultLang } });

    return setData(keys);
  };

  useEffect(() => {
    setLanguageData();
    setHtml();
  }, []);

  const handleLanguageSelect = ({ target: { value } }) => {
    setSelected(value);
    insertHtml(linkByLand[value].html);
  };

  const insertHtml = async (file) => {
    const doc = await fetchDoc(id, file);
    setHtml(doc);
  };

  const renderSelect = () => (
    <TextField
      variant="outlined"
      fullWidth
      onChange={handleLanguageSelect}
      value={selected}
      select
    >
      {data.map(mapOption)}
    </TextField>
  );

  const renderDoc = () => {
    return (<div dangerouslySetInnerHTML={{ __html: html }}></div>);
  };

  return (
    <Box style={{ height: 'calc(100vh - 140px)', overflow: 'auto' }}>
      {renderSelect()}
      {renderDoc()}
    </Box>
  );

};

export default LoadSourceContainer;

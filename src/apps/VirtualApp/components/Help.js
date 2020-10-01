import React, { useRef, useState } from 'react';
import { ListItemIcon, List, ListItemText, ListItem } from '@material-ui/core';
import { Help as HelpIcon } from '@material-ui/icons';
import Menu from '@material-ui/core/Menu';

export const Help = ({ t }) => {
  const [open, setOpen] = React.useState(false);
  const anchorRef       = useRef();

  const handleClick = (event) => {
    setOpen(!open);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const renderList = () => {
    return (
      <List>
        <ListItem button onClick={() => window.open('https://bit.ly/2JkBU08', '_blank')}>
          <ListItemText>English</ListItemText>
        </ListItem>
        <ListItem button onClick={() => window.open('https://bit.ly/39miYbJ', '_blank')}>
          <ListItemText>Spanish</ListItemText>
        </ListItem>
        <ListItem button onClick={() => window.open('https://bit.ly/3amR5BV', '_blank')}>
          <ListItemText>Hebrew</ListItemText>
        </ListItem>
        <ListItem button onClick={() => window.open('https://bit.ly/2UE1l1Y', '_blank')}>
          <ListItemText>Russian</ListItemText>
        </ListItem>
      </List>
    );
  };

  return (
    <ListItem ref={anchorRef} button key={'help'} onClick={handleClick}>
      <ListItemText primary={t('feedback.help')} />
      <ListItemIcon><HelpIcon /></ListItemIcon>
      <Menu
        id="help-menu"
        anchorEl={anchorRef.current}
        open={open}
        onClose={handleClose}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {
          renderList()
        }
      </Menu>
    </ListItem>
  );
};

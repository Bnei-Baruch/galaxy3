import React, { useRef } from 'react';
import { ButtonGroup, Tooltip, IconButton, Popover, SvgIcon } from '@material-ui/core';

function EqualIcon() {
  return (
    <SvgIcon>
      <path d="M2 5H8V9H2V5Z M2 10H8V14H2V10Z M8 15H2V19H8V15Z M9 5H15V9H9V5Z M15 10H9V14H15V10Z M9 15H15V19H9V15Z M22 5H16V9H22V5Z M16 10H22V14H16V10Z M22 15H16V19H22V15Z" />
    </SvgIcon>
  );
}

function DoubleIcon() {
  return (
    <SvgIcon>
      <path d="M15 5H2V14H15V5Z M8 15H2V19H8V15Z M9 15H15V19H9V15Z M22 5H16V9H22V5Z M16 10H22V14H16V10Z M22 15H16V19H22V15Z" />
    </SvgIcon>
  );
}

function SplitIcon() {
  return (
    <SvgIcon>
      <path d="M2 5H12V19H2V5Z M13 15H17V19H13V15Z M17 10H13V14H17V10Z M13 5H17V9H13V5Z M22 15H18V19H22V15Z M18 10H22V14H18V10Z M22 5H18V9H22V5Z" />
    </SvgIcon>
  );
}

const Layout = (props) => {
  const { disabled, t, action, active } = props;
  const [open, setOpen]                 = React.useState(false);
  const anchorRef                       = useRef();

  const handleMenuItemClick = (type) => {
    console.log('layout type', type);
    action(type);
    setOpen(false);
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const getButtonByName = (name) => {
    return (
      <IconButton
        onClick={() => handleMenuItemClick(name)}
      >
        {name === 'double' && <DoubleIcon />}
        {name === 'split' && <SplitIcon />}
        {name === 'equal' && <EqualIcon />}
      </IconButton>
    );
  };

  return (
    <div>
      <Tooltip title={t('oldClient.layout')} disableTouchListener={true}>
        <span>
          <IconButton
            aria-label={t('oldClient.layout')}
            disabled={disabled}
            onClick={handleToggle}
            ref={anchorRef}
          >
            {active === 'double' && <DoubleIcon />}
            {active === 'split' && <SplitIcon />}
            {active === 'equal' && <EqualIcon />}
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}>
        <ButtonGroup>
          <ButtonGroup variant="contained" color="default">
            {getButtonByName('double')}
            {getButtonByName('split')}
            {getButtonByName('equal')}
          </ButtonGroup>
        </ButtonGroup>
      </Popover>
    </div>
  );
};

export { Layout };
export default Layout;

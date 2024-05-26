import React, {useContext} from "react";
import {Button, ListItemIcon, ListItemText, Menu, MenuItem} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import FeaturedVideoIcon from '@mui/icons-material/FeaturedVideo';
import {GlobalOptionsContext} from "../GlobalOptions/GlobalOptions";
import {grey} from "@mui/material/colors";
import {useTranslation} from "react-i18next";

const VideoPanelOptions = () => {
  const {toggleHideSelf} = useContext(GlobalOptionsContext)
  const [anchorEl, setAnchorEl] = React.useState(null);
  const {t} = useTranslation()

  const open = Boolean(anchorEl);

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleToggle = () => {
    setAnchorEl(null);
    toggleHideSelf()
  }


  return (
    <div className="video-panel-options">
      <Button onClick={handleOpen}>
        <MoreVertIcon style={{color: grey[50]}}/>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{'aria-labelledby': 'basic-button'}}
      >
        <MenuItem onClick={handleToggle}>
          <ListItemIcon>
            <FeaturedVideoIcon/>
          </ListItemIcon>
          <ListItemText>{t("galaxyApp.hideSelfView")}</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  )
    ;
};

export default VideoPanelOptions;


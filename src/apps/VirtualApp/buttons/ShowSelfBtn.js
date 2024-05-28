import React, {useContext} from "react";
import {useTranslation} from "react-i18next";
import {IconButton, Tooltip} from "@mui/material";
import PortraitIcon from '@mui/icons-material/Portrait';

import {GlobalOptionsContext} from "../components/GlobalOptions/GlobalOptions";

const ShowSelfBtn = () => {
  const {t} = useTranslation()
  const {hideSelf, toggleHideSelf} = useContext(GlobalOptionsContext)

  return (
    <Tooltip
      title={t(`galaxyApp.${hideSelf ? 'show' : 'hide'}SelfView`)}
      disableTouchListener={true}
    >
      <span>
        <IconButton
          onClick={toggleHideSelf}
          size="large"
        >
          <PortraitIcon color={hideSelf ? "secondary" : "primary"}/>
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default ShowSelfBtn;

import React, {useContext} from "react";
import {IconButton, Tooltip} from "@mui/material";
import {GlobalOptionsContext} from "../components/GlobalOptions/GlobalOptions";
import FeaturedVideoIcon from "@mui/icons-material/FeaturedVideo";
import {useTranslation} from "react-i18next";

const ShowSelfBtn = () => {
  const {t} = useTranslation()
  const {hideSelf, toggleHideSelf} = useContext(GlobalOptionsContext)
  if (!hideSelf) return null

  return (
    <Tooltip title={t("galaxyApp.showSelfView")} disableTouchListener={true}>
      <span>
        <IconButton
          onClick={toggleHideSelf}
          size="large"
        >
          <FeaturedVideoIcon color="secondary"/>
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default ShowSelfBtn;

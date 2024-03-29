import React, {useRef} from "react";
import {ThumbsUpDown} from "@mui/icons-material";
import {Tooltip, IconButton, Popover} from "@mui/material";

const Vote = (props) => {
  const {disabled, t, id} = props;
  const [open, setOpen] = React.useState(false);
  const ref = useRef();

  const handleClick = (event) => {
    setOpen(!open);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div>
      <Tooltip title={t("oldClient.vote")} disableTouchListener={true}>
        <span>
          <IconButton aria-label={t("oldClient.vote")} disabled={disabled} onClick={handleClick} ref={ref} size="large">
            <ThumbsUpDown />
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={ref.current}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        <iframe
          title={`${t("oldClient.vote")} 1`}
          src={`https://vote.kli.one/button.html?answerId=1&userId=${id}`}
          width="40px"
          height="36px"
          frameBorder="0"
        ></iframe>
        <iframe
          title={`${t("oldClient.vote")} 2`}
          src={`https://vote.kli.one/button.html?answerId=2&userId=${id}`}
          width="40px"
          height="36px"
          frameBorder="0"
        ></iframe>
      </Popover>
    </div>
  );
};

export {Vote};
export default Vote;

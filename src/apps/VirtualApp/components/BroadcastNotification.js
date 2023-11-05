import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

//export const UI_LANGUAGES = ["en", "es", "he", "ru"];

export const DEFAULT_LANGUAGE = "en";

export const getLanguage = () => localStorage.getItem("lng") || DEFAULT_LANGUAGE;

export const BroadcastNotification = ({show, msg, setClose}) => {

    const lang = getLanguage()
    const message = msg[lang]

    return (
        <div>
            <Dialog
                open={show}
                onClose={setClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                style={{zIndex:1301}}
            >
                <DialogTitle id="alert-dialog-title">
                    {"Arvut System Notification"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        {message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={setClose} autoFocus>Ok</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

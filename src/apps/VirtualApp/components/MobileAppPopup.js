import * as React from 'react';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {isAndroid, isIOS, isMobile} from 'react-device-detect';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import {APP_STORE_URL, GOOGLE_PLAY_URL, MOBILE_APK_URL} from '../../../shared/env';

export const MobileAppPopup = () => {
    const {t} = useTranslation();
    const [open, setOpen] = useState(isMobile);

    const close = () => setOpen(false);

    const googlePlay = (
        <Button key="gp" variant={isIOS ? 'outlined' : 'contained'} href={GOOGLE_PLAY_URL}
                target="_blank" rel="noopener noreferrer">
            {t('mobileApp.googlePlay')}
        </Button>
    );
    const appStore = (
        <Button key="as" variant={isIOS ? 'contained' : 'outlined'} href={APP_STORE_URL}
                target="_blank" rel="noopener noreferrer">
            {t('mobileApp.appStore')}
        </Button>
    );
    const stores = isIOS ? [appStore, googlePlay] : [googlePlay, appStore];

    return (
        <Dialog
            open={open}
            onClose={close}
            aria-labelledby="mobile-app-dialog-title"
            aria-describedby="mobile-app-dialog-description"
            style={{zIndex: 1301}}
        >
            <DialogTitle id="mobile-app-dialog-title">
                {t('mobileApp.title')}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="mobile-app-dialog-description">
                    {t('mobileApp.text')}
                </DialogContentText>
                <Stack spacing={1} sx={{mt: 2}}>
                    {stores}
                    {!isIOS && MOBILE_APK_URL && (
                        <Button variant={isAndroid ? 'outlined' : 'text'} href={MOBILE_APK_URL} download>
                            {t('mobileApp.downloadApk')}
                        </Button>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={close}>{t('mobileApp.continueBrowser')}</Button>
            </DialogActions>
        </Dialog>
    );
}

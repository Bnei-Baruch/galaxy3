import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import {LANG_MAP} from "../../../shared/consts";

export const getLanguage = () => LANG_MAP[localStorage.getItem("vrt_langtext")] || "en";
const lang = getLanguage()
export const BroadcastNotification = ({show, msg, setClose}) => {
    const [value, setValue] = React.useState(lang);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <div>
            <Dialog
                open={show}
                onClose={setClose}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
                style={{zIndex:1301}}
            >
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        <TabContext value={value}>
                            <TabList onChange={handleChange} aria-label="lab API tabs example">
                                <Tab label="English" value="en" />
                                <Tab label="Russian" value="ru" />
                                <Tab label="Hebrew" value="he" />
                                <Tab label="Spanish" value="es" />
                            </TabList>
                            <TabPanel className="notification" value="en"><div dangerouslySetInnerHTML={{__html: msg[value]}}></div></TabPanel>
                            <TabPanel className="notification" value="ru"><div dangerouslySetInnerHTML={{__html: msg[value]}}></div></TabPanel>
                            <TabPanel className="notification" value="he"><div dangerouslySetInnerHTML={{__html: msg[value]}}></div></TabPanel>
                            <TabPanel className="notification" value="es"><div dangerouslySetInnerHTML={{__html: msg[value]}}></div></TabPanel>
                        </TabContext>
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={setClose} autoFocus>Ok</Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}

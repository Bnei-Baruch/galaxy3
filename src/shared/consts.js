
export const MAX_FEEDS = 20;
export const DATA_PORT = 5102;
export const PROTOCOL_ROOM = 1000;
export const SHIDUR_ID = "ce332655-d702-40d0-83eb-a6b950976984";
export const SNDMAN_ID = "90966d26-0777-4179-9773-d7cd5456a5ed";
export const SDIOUT_ID = "91966d26-0777-4179-9773-d7cd5456a5ed";
export const STORAN_ID = "e97c7b89-bd3a-46b5-87f2-7b64559561d4";
export const DANTE_IN_IP = process.env.REACT_APP_DANTE_IN_IP;
export const WFRP_STATE = process.env.REACT_APP_WFRP_STATE;
export const WFDB_STATE = process.env.REACT_APP_WFDB_STATE;
export const STUN_SRV_STR = process.env.REACT_APP_STUN_SRV_STR;
export const STUN_SRV_GXY = process.env.REACT_APP_STUN_SRV_GXY;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;
export const JANUS_SRV_VRT = process.env.REACT_APP_JANUS_SRV_VRT;
export const JANUS_SRV_GXY = process.env.REACT_APP_JANUS_SRV_GXY;
export const JANUS_ADMIN_VRT = process.env.REACT_APP_ADMIN_SRV_VRT;
export const JANUS_ADMIN_GXY = process.env.REACT_APP_ADMIN_SRV_GXY;
export const JANUS_SRV_ISRPT = process.env.REACT_APP_JANUS_SRV_ISRPT;
export const JANUS_SRV_EURND = process.env.REACT_APP_JANUS_SRV_EURND;
export const JANUS_SRV_EURUK = process.env.REACT_APP_JANUS_SRV_EURUK;
export const JANUS_SRV_EURFR = process.env.REACT_APP_JANUS_SRV_EURFR;
export const JANUS_SRV_ISRLC = process.env.REACT_APP_JANUS_SRV_ISRLC;
export const JANUS_IP_ISRPT = process.env.REACT_APP_JANUS_IP_ISRPT;
export const JANUS_IP_EURND = process.env.REACT_APP_JANUS_IP_EURND;
export const JANUS_IP_EURUK = process.env.REACT_APP_JANUS_IP_EURUK;
export const JANUS_IP_EURFR = process.env.REACT_APP_JANUS_IP_EURFR;


export const servers_options = [
    { key: 1, text: 'Israel (PT)', value: `${JANUS_SRV_ISRPT}` },
    { key: 2, text: 'Europe (ND)', value: `${JANUS_SRV_EURND}` },
    { key: 3, text: 'Europe (UK)', value: `${JANUS_SRV_EURUK}` },
    { key: 4, text: 'Europe (FR)', value: `${JANUS_SRV_EURFR}` },
    { key: 5, text: 'Merkaz (PT)', value: `${JANUS_SRV_ISRLC}` },
];

export const videos_options = [
    { key: 1, text: '240p', value: 11 },
    { key: 2, text: '360p', value: 1 },
    { key: 3, text: '720p', value: 16 },
    { key: 4, text: 'NoVideo', value: 3 },
];

export const admin_videos_options = [
    { key: 1, text: '240p', value: 11 },
    { key: 2, text: '360p', value: 1 },
    { key: 3, text: '480p', value: 66 },
    { key: 4, text: '720p', value: 16 },
    { key: 5, text: 'RTCP', value: 103 },
    { key: 6, text: 'NoVideo', value: 4 },
];

export const audios_options = [
    { key: 100, value: 100, text: 'Focus Group', disabled: true, icon: "tags" },
    { key: 'he', value: 15, flag: 'il', text: 'Hebrew' },
    { key: 'ru', value: 23, flag: 'ru', text: 'Russian' },
    { key: 'en', value: 24, flag: 'us', text: 'English' },
    { key: 'es', value: 26, flag: 'es', text: 'Spanish' },
    { key: 'fr', value: 25, flag: 'fr', text: 'French' },
    { key: 'it', value: 28, flag: 'it', text: 'Italian' },
    { key: 'de', value: 27, flag: 'de', text: 'German' },
    { key: 'tr', value: 42, flag: 'tr', text: 'Turkish' },
    { key: 'pt', value: 41, flag: 'pt', text: 'Portuguese' },
    { key: 'bg', value: 43, flag: 'bg', text: 'Bulgarian' },
    { key: 'ka', value: 44, flag: 'ge', text: 'Georgian' },
    { key: 'ro', value: 45, flag: 'ro', text: 'Romanian' },
    { key: 'hu', value: 46, flag: 'hu', text: 'Hungarian' },
    { key: 'sv', value: 47, flag: 'se', text: 'Swedish' },
    { key: 'lt', value: 48, flag: 'lt', text: 'Lithuanian' },
    { key: 'hr', value: 49, flag: 'hr', text: 'Croatian' },
    { key: 'ja', value: 50, flag: 'jp', text: 'Japanese' },
    { key: 'sl', value: 51, flag: 'si', text: 'Slovenian' },
    { key: 'pl', value: 52, flag: 'pl', text: 'Polish' },
    { key: 'no', value: 53, flag: 'no', text: 'Norwegian' },
    { key: 'lv', value: 54, flag: 'lv', text: 'Latvian' },
    { key: 'ua', value: 55, flag: 'ua', text: 'Ukrainian' },
    { key: 'nl', value: 56, flag: 'nl', text: 'Dutch' },
    { key: 'cn', value: 57, flag: 'cn', text: 'Chinese' },
    { key: 'et', value: 58, flag: 'et', text: 'Amharic' },
    { key: 'in', value: 59, flag: 'in', text: 'Hindi' },
    { key: 'ir', value: 60, flag: 'ir', text: 'Persian' },
    { key: 101, value: 101, text: 'W/O Focus Group', disabled: true, icon: "tags"},
    { key: 2, value: 2, flag: 'il', text: 'Hebrew' },
    { key: 3, value: 3, flag: 'ru', text: 'Russian' },
    { key: 4, value: 4, flag: 'us', text: 'English' },
    { key: 6, value: 6, flag: 'es', text: 'Spanish' },
    { key: 5, value: 5, flag: 'fr', text: 'French' },
    { key: 8, value: 8, flag: 'it', text: 'Italian' },
    { key: 7, value: 7, flag: 'de', text: 'German' },
    { key: 102, value: 102, text: 'Special', disabled: true, icon: "tags" },
    { key: 10, value: 10, text: 'Heb - Rus' },
    { key: 17, value: 17, text: 'Heb - Eng' },
    { key: 201, value: 201, text: 'Galaxy1' },
    { key: 203, value: 203, text: 'Galaxy2' },
    { key: 202, value: 202, text: 'Galaxy4' },
    { key: 204, value: 204, text: 'Galaxy5' },
];

export const audiog_options = [
    { key: 101, value: 101, text: 'Workshop', disabled: true, icon: "tags", selected: true},
    { key: 2, value: 2, flag: 'il', text: 'Hebrew' },
    { key: 3, value: 3, flag: 'ru', text: 'Russian' },
    { key: 4, value: 4, flag: 'us', text: 'English' },
    { key: 6, value: 6, flag: 'es', text: 'Spanish' },
    { key: 5, value: 5, flag: 'fr', text: 'French' },
    { key: 8, value: 8, flag: 'it', text: 'Italian' },
    { key: 7, value: 7, flag: 'de', text: 'German' },
    { key: 100, value: 100, text: 'Source', disabled: true, icon: "tags", selected: true},
    { key: 'he', value: 15, flag: 'il', text: 'Hebrew' },
    { key: 'ru', value: 23, flag: 'ru', text: 'Russian' },
    { key: 'en', value: 24, flag: 'us', text: 'English' },
    { key: 'es', value: 26, flag: 'es', text: 'Spanish' },
    { key: 'fr', value: 25, flag: 'fr', text: 'French' },
    { key: 'it', value: 28, flag: 'it', text: 'Italian' },
    { key: 'de', value: 27, flag: 'de', text: 'German' },
    { key: 'tr', value: 42, flag: 'tr', text: 'Turkish' },
    { key: 'pt', value: 41, flag: 'pt', text: 'Portuguese' },
    { key: 'bg', value: 43, flag: 'bg', text: 'Bulgarian' },
    { key: 'ka', value: 44, flag: 'ge', text: 'Georgian' },
    { key: 'ro', value: 45, flag: 'ro', text: 'Romanian' },
    { key: 'hu', value: 46, flag: 'hu', text: 'Hungarian' },
    { key: 'sv', value: 47, flag: 'se', text: 'Swedish' },
    { key: 'lt', value: 48, flag: 'lt', text: 'Lithuanian' },
    { key: 'hr', value: 49, flag: 'hr', text: 'Croatian' },
    { key: 'ja', value: 50, flag: 'jp', text: 'Japanese' },
    { key: 'sl', value: 51, flag: 'si', text: 'Slovenian' },
    { key: 'pl', value: 52, flag: 'pl', text: 'Polish' },
    { key: 'no', value: 53, flag: 'no', text: 'Norwegian' },
    { key: 'lv', value: 54, flag: 'lv', text: 'Latvian' },
    { key: 'ua', value: 55, flag: 'ua', text: 'Ukrainian' },
    { key: 'nl', value: 56, flag: 'nl', text: 'Dutch' },
    { key: 'cn', value: 57, flag: 'cn', text: 'Chinese' },
    { key: 99, value: 99, text: 'Special', disabled: true, icon: "tags", selected: true},
    { key: 'heru', value: 10, text: 'Heb-Rus' },
    { key: 'heen', value: 17, text: 'Heb-Eng' },
];

export const gxycol = [0, 201, 203, 202, 204];

export const trllang = {
        "Hebrew": 301,
        "Russian": 302,
        "English": 303,
        "French": 305,
        "Spanish": 304,
        "German": 307,
        "Italian": 306
};
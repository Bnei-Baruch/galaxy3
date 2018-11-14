
export const MAX_FEEDS = 20;
export const DATA_PORT = 5102;
export const PROTOCOL_ROOM = 1000;
export const DANTE_IN_IP = process.env.REACT_APP_DANTE_IN_IP;
export const WFRP_STATE = process.env.REACT_APP_WFRP_STATE;
export const WFDB_STATE = process.env.REACT_APP_WFDB_STATE;
export const JANUS_SERVER = process.env.REACT_APP_JANUS_SERVER;
export const JANUS_ADMIN = process.env.REACT_APP_JANUS_ADMIN;
export const STUN_SERVER = process.env.REACT_APP_STUN_EUR_SRV;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;
export const JANUS_SRV_ISRPT = process.env.REACT_APP_JANUS_SRV_ISRPT;
export const JANUS_SRV_EURND = process.env.REACT_APP_JANUS_SRV_EURND;
export const JANUS_SRV_EURUK = process.env.REACT_APP_JANUS_SRV_EURUK;
export const JANUS_SRV_ISRLC = process.env.REACT_APP_JANUS_SRV_ISRLC;
export const JANUS_IP_ISRPT = process.env.REACT_APP_JANUS_IP_ISRPT;
export const JANUS_IP_EURND = process.env.REACT_APP_JANUS_IP_EURND;
export const JANUS_IP_EURUK = process.env.REACT_APP_JANUS_IP_EURUK;


export const servers_options = [
    { key: 1, text: 'Israel (PT)', value: `${JANUS_SRV_ISRPT}` },
    { key: 2, text: 'Europe (ND)', value: `${JANUS_SRV_EURND}` },
    { key: 3, text: 'Europe (UK)', value: `${JANUS_SRV_EURUK}` },
    { key: 4, text: 'Merkaz (PT)', value: `${JANUS_SRV_ISRLC}` },
];

export const videos_options = [
    { key: 1, text: '600Kb/s', value: 1 },
    { key: 2, text: '300Kb/s', value: 11 },
    { key: 3, text: 'NoVideo', value: 3 },
];

export const admin_videos_options = [
    { key: 1, text: '600Kb/s', value: 1 },
    { key: 2, text: '300Kb/s', value: 11 },
    { key: 3, text: 'RTCP', value: 103 },
    { key: 4, text: 'NoVideo', value: 4 },
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
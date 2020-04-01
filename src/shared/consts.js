
export const MAX_FEEDS = 20;
export const DATA_PORT = 5102;
export const PROTOCOL_ROOM = 1000;
export const GROUPS_ROOM = 1234;
export const SHIDUR_ID = "4ab867e5-46f9-47b9-bd6d-47a6df784d92";
export const SNDMAN_ID = "720f133f-b8e2-49a8-a148-7bd80763ae55";
export const SDIOUT_ID = "91966d26-0777-4179-9773-d7cd5456a5ed";
export const STORAN_ID = "28c8d37e-d86f-4c8c-9f89-f3b92e81f13e";
export const GEO_IP_INFO = process.env.REACT_APP_GEO_IP_INFO;
export const DANTE_IN_IP = process.env.REACT_APP_DANTE_IN_IP;
export const WFRP_STATE = process.env.REACT_APP_WFRP_STATE;
export const WFDB_STATE = process.env.REACT_APP_WFDB_STATE;
export const STUN_SRV_STR = process.env.REACT_APP_STUN_SRV_STR;
export const STUN_SRV_GXY = process.env.REACT_APP_STUN_SRV_GXY;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;
export const JANUS_SRV_GXY1 = process.env.REACT_APP_JANUS_SRV_GXY1;
export const JANUS_SRV_GXY2 = process.env.REACT_APP_JANUS_SRV_GXY2;
export const JANUS_SRV_GXY3 = process.env.REACT_APP_JANUS_SRV_GXY3;
export const JANUS_ADMIN_VRT = process.env.REACT_APP_ADMIN_SRV_VRT;
export const JANUS_ADMIN_GXY = process.env.REACT_APP_ADMIN_SRV_GXY;
export const JANUS_ADMIN_GXY1 = process.env.REACT_APP_ADMIN_SRV_GXY1;
export const JANUS_ADMIN_GXY2 = process.env.REACT_APP_ADMIN_SRV_GXY2;
export const JANUS_ADMIN_GXY3 = process.env.REACT_APP_ADMIN_SRV_GXY3;
export const JANUS_SRV_STR1 = process.env.REACT_APP_JANUS_SRV_STR1;
export const JANUS_SRV_STR2 = process.env.REACT_APP_JANUS_SRV_STR2;
export const JANUS_SRV_STR3 = process.env.REACT_APP_JANUS_SRV_STR3;
export const JANUS_SRV_STR4 = process.env.REACT_APP_JANUS_SRV_STR4;
export const JANUS_STR_HOST_IL = process.env.REACT_APP_JANUS_HOST_IL;
export const JANUS_STR_HOST_PL = process.env.REACT_APP_JANUS_HOST_PL;
export const JANUS_STR_HOST_GR = process.env.REACT_APP_JANUS_HOST_GR;
export const JANUS_STR_HOST_UK = process.env.REACT_APP_JANUS_HOST_UK;

export const JANUS_GATEWAYS = ["gxy1", "gxy2", "gxy3"];
// TODO (edo): put all janus instance configs in a single object

export const MONITORING_BACKEND = process.env.REACT_APP_MONITORING_BACKEND;

export const vsettings_list = [
    { key: 0, text: '320 x 180, 15 fps', value: {width: 320, height: 180, fps: 15}},
    { key: 1, text: '320 x 180, 30 fps', value: {width: 320, height: 180, fps: 30} },
    { key: 2, text: '640 x 360, 15 fps', value: {width: 640, height: 360, fps: 15} },
    { key: 3, text: '640 x 360, 30 fps', value: {width: 640, height: 360, fps: 30} },
];

export const videos_options = [
    { key: 1, text: '240p', value: 11 },
    { key: 2, text: '360p', value: 1 },
    { key: 3, text: '720p', value: 16 },
    { key: 4, text: 'NoVideo', value: 3 },
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
        "Italian": 306,
        "Turkish": 308,
        "Bulgarian": 310,
        "Romanian": 312,
        "Lithuanian": 315,
        "Ukrainian": 322
};

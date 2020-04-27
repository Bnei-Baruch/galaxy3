export const MAX_FEEDS = 20;
export const DATA_PORT = 5102;
export const PROTOCOL_ROOM = 1000;
export const SERVICE_ROOM = 1001;
export const GROUPS_ROOM = 1234;
export const SHIDUR_ID = "4ab867e5-46f9-47b9-bd6d-47a6df784d92";
export const SNDMAN_ID = "720f133f-b8e2-49a8-a148-7bd80763ae55";
export const SDIOUT_ID = "91966d26-0777-4179-9773-d7cd5456a5ed";
export const STORAN_ID = "28c8d37e-d86f-4c8c-9f89-f3b92e81f13e";

export const JANUS_GATEWAYS = ["gxy1", "gxy2", "gxy3"];
// TODO (edo): put all janus instance configs in a single object

export const vsettings_list = [
    { key: 0, text: '320 x 180, 15 fps', value: {width: 320, height: 180, fps: 15}},
    { key: 1, text: '320 x 180, 30 fps', value: {width: 320, height: 180, fps: 30} },
    { key: 2, text: '640 x 360, 15 fps', value: {width: 640, height: 360, fps: 15} },
    { key: 3, text: '640 x 360, 30 fps', value: {width: 640, height: 360, fps: 30} },
];

export const NO_VIDEO_OPTION_VALUE = -1;

export const videos_options = [
    { key: 1, text: '240p', value: 11 },
    { key: 2, text: '360p', value: 1 },
    { key: 3, text: '720p', value: 16 },
    { key: 4, text: 'NoVideo', value: NO_VIDEO_OPTION_VALUE },
];

export const videos_options2 = [
    { key: 1, text: 'Low quality', description:"240p", value: 11 },
    { key: 2, text: 'Medium quality', description:"360p", value: 1 },
    { key: 3, text: 'High quality', description:"720p", value: 16 },
    {divider:true},
    { key: 4, text: 'No Video', description:"Audio only", value: NO_VIDEO_OPTION_VALUE },
];
export const audiog_options2 = [
    
    { header: true, text: 'Stream for workshop', description:'(focus group is muted)', icon: 'group'},
    { key: 2, value: 2, flag: 'il', icon:'group', eng_text: 'Hebrew', text:'עברית' },
    { key: 3, value: 3, flag: 'ru', icon:'group', eng_text: 'Russian', text:'Русский' },
    { key: 4, value: 4, flag: 'us', icon:'group', eng_text: 'English', text:'English' },
    { key: 6, value: 6, flag: 'es', icon:'group', eng_text: 'Spanish', text:'Español' },
    { key: 5, value: 5, flag: 'fr', icon:'group', eng_text: 'French', text:'Français' },
    { key: 8, value: 8, flag: 'it', icon:'group', eng_text: 'Italian', text:'Italiano' },
    { key: 7, value: 7, flag: 'de', icon:'group', eng_text: 'German', text:'Deutsch' },
    {divider:true},
    { header: true, text: 'Source stream', description:'(focus group is on)', icon: 'crosshairs'},
    { key: 'he', value: 15, flag: 'il', icon:'crosshairs', eng_text: 'Hebrew', text:'עברית' },
    { key: 'ru', value: 23, flag: 'ru', icon:'crosshairs', eng_text: 'Russian', text:'Русский' },
    { key: 'en', value: 24, flag: 'us', icon:'crosshairs', eng_text: 'English', text:'English' },
    { key: 'es', value: 26, flag: 'es', icon:'crosshairs', eng_text: 'Spanish', text:'Español' },
    { key: 'fr', value: 25, flag: 'fr', icon:'crosshairs', eng_text: 'French', text:'Français' },
    { key: 'it', value: 28, flag: 'it', icon:'crosshairs', eng_text: 'Italian', text:'Italiano' },
    { key: 'de', value: 27, flag: 'de', icon:'crosshairs', eng_text: 'German', text:'Deutsch' },
    { key: 'tr', value: 42, flag: 'tr', icon:'crosshairs', eng_text: 'Turkish', text:'Türkçe' },
    { key: 'pt', value: 41, flag: 'pt', icon:'crosshairs', eng_text: 'Portuguese', text:'Português' },
    { key: 'bg', value: 43, flag: 'bg', icon:'crosshairs', eng_text: 'Bulgarian', text:'Български' },
    { key: 'ka', value: 44, flag: 'ge', icon:'crosshairs', eng_text: 'Georgian', text:'ქაბალა' },
    { key: 'ro', value: 45, flag: 'ro', icon:'crosshairs', eng_text: 'Romanian', text:'Romanian' },
    { key: 'hu', value: 46, flag: 'hu', icon:'crosshairs', eng_text: 'Hungarian', text:'Magyar' },
    { key: 'sv', value: 47, flag: 'se', icon:'crosshairs', eng_text: 'Swedish', text:'Svenska' },
    { key: 'lt', value: 48, flag: 'lt', icon:'crosshairs', eng_text: 'Lithuanian', text:'Lietuvių' },
    { key: 'hr', value: 49, flag: 'hr', icon:'crosshairs', eng_text: 'Croatian', text:'Hrvatski' },
    { key: 'ja', value: 50, flag: 'jp', icon:'crosshairs', eng_text: 'Japanese', text:'語本日  ラバカ' },
    { key: 'sl', value: 51, flag: 'si', icon:'crosshairs', eng_text: 'Slovenian', text:'Slovenščina' },
    { key: 'pl', value: 52, flag: 'pl', icon:'crosshairs', eng_text: 'Polish', text:'Polski' },
    { key: 'no', value: 53, flag: 'no', icon:'crosshairs', eng_text: 'Norwegian', text:'Norsk' },
    { key: 'lv', value: 54, flag: 'lv', icon:'crosshairs', eng_text: 'Latvian', text:'Latviešu' },
    { key: 'ua', value: 55, flag: 'ua', icon:'crosshairs', eng_text: 'Ukrainian', text:'Українська' },
    { key: 'nl', value: 56, flag: 'nl', icon:'crosshairs', eng_text: 'Dutch', text:'Nederlands' },
    { key: 'cn', value: 57, flag: 'cn', icon:'crosshairs', eng_text: 'Chinese', text:'中文' },
    { key: 'et', value: 58, flag: 'et', icon:'crosshairs', eng_text: 'Amharic', text: 'አማርኛ' },
    { key: 'in', value: 59, flag: 'in', icon:'crosshairs', eng_text: 'Hindi', text: 'हिन्दी' },
    { key: 'ir', value: 60, flag: 'ir', icon:'crosshairs', eng_text: 'Persian', text: 'فارسی' },
    {divider:true},
    { header: true, text: 'Dual languages stream', description:'(focus group is muted)', icon: 'group'},
    { key: 'heru', value: 10, icon:'group', eng_text: 'Heb-Rus', text:'Русский-עברית' },
    { key: 'heen', value: 17, icon:'group', eng_text: 'Heb-Eng', text:'English-עברית' },
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
    { key: 'et', value: 58, flag: 'et', text: 'Amharic' },
    { key: 'in', value: 59, flag: 'in', text: 'Hindi' },
    { key: 'ir', value: 60, flag: 'ir', text: 'Persian' },
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

export const MAX_FEEDS = 20;
export const DATA_PORT = 5102;
export const PROTOCOL_ROOM = 1000;
export const SERVICE_ROOM = 1001;
export const GROUPS_ROOM = 1234;
export const LOST_CONNECTION = "Lost connection to the server (is it down?)";

export const USERNAME_ALREADY_EXIST_ERROR_CODE = 420;
export const ALREADY_IN_ROOM_ERROR_CODE = 421;
export const NOTRL_STREAM_ID = 64;

export const SHIDUR_ID = "4ab867e5-46f9-47b9-bd6d-47a6df784d92";
export const SNDMAN_ID = "720f133f-b8e2-49a8-a148-7bd80763ae55";
export const SDIOUT_ID = "91966d26-0777-4179-9773-d7cd5456a5ed";
export const QSTOUT_ID = "91966d26-0777-4179-9773-d7cd5456a6ed";
export const STORAN_ID = "28c8d37e-d86f-4c8c-9f89-f3b92e81f13e";
export const AUDOUT_ID = "91966d26-0777-4179-9773-d7cd5456a5ao";

export const vsettings_list = [
  {key: 0, text: "320 x 180, 15 fps", value: {width: 320, height: 180, ideal: 15}, mobileText: "low"},
  {key: 1, text: "320 x 180, 30 fps", value: {width: 320, height: 180, ideal: 30}, mobileText: "medium"},
  {key: 2, text: "640 x 360, 15 fps", value: {width: 640, height: 360, ideal: 15}, mobileText: "high"},
  {key: 3, text: "640 x 360, 30 fps", value: {width: 640, height: 360, ideal: 30}, mobileText: "mhigh"},
  {key: 3, text: "1280 x 720, 30 fps", value: {width: 1280, height: 720, ideal: 30}, mobileText: "shigh"},
];

export const NO_VIDEO_OPTION_VALUE = -1;
export const VIDEO_240P_OPTION_VALUE = 11;
export const VIDEO_360P_OPTION_VALUE = 1;
export const VIDEO_720P_OPTION_VALUE = 16;
export const VIDEO_IS_AV1_360P_OPTION_VALUE = 132;

export const videos_options = [
  {key: 1, text: "240p", value: VIDEO_240P_OPTION_VALUE},
  {key: 2, text: "360p", value: VIDEO_360P_OPTION_VALUE},
  {key: 3, text: "720p", value: VIDEO_720P_OPTION_VALUE},
  {key: 4, text: "NoVideo", value: NO_VIDEO_OPTION_VALUE},
];

export const videos_options2 = [
  {key: 1, text: "oldClient.lowQuality", description: "240p", value: 11},
  {key: 2, text: "oldClient.mediumQuality", description: "360p", value: 1},
  {key: 3, text: "oldClient.highQuality", description: "720p", value: 16},
  {divider: true},
  {key: 4, text: "oldClient.noVideo", description: "oldClient.audioOnly", value: NO_VIDEO_OPTION_VALUE},
];

export const videos_options_av1 = [
  {key: 1, text: "oldClient.lowQuality", description: "240p", value: 133},
  {key: 2, text: "oldClient.mediumQuality", description: "360p", value: 132},
  {key: 3, text: "oldClient.highQuality", description: "720p", value: 131},
  {key: 5, text: "oldClient.HDQuality", description: "1080p", value: 130},
  {divider: true},
  {key: 4, text: "oldClient.noVideo", description: "oldClient.audioOnly", value: NO_VIDEO_OPTION_VALUE},
];

export const subtitle_options = [
  {key: "he", value: "he", eng_text: "Hebrew", text: "עברית"},
  {key: "ru", value: "ru", eng_text: "Russian", text: "Русский"},
  {key: "en", value: "en", eng_text: "English", text: "English"},
  {key: "es", value: "es", eng_text: "Spanish", text: "Español"},
  {key: "tr", value: "tr", eng_text: "Turkish", text: "Türkçe"},
  {key: "ua", value: "ua", eng_text: "Ukrainian", text: "Українська"},
];
export const audiog_options2 = [
  {
    header: true,
    text: "oldClient.streamForWorkshop",
    description: "oldClient.streamForWorkshopDescription",
    icon: "group",
  },
  {key: 1, value: 64, icon: "group", eng_text: "Original", text: "Original"},
  {key: 2, value: 2, icon: "group", eng_text: "Hebrew", text: "עברית", langKey: "he"},
  {key: 3, value: 3, icon: "group", eng_text: "Russian", text: "Русский", langKey: "ru"},
  {key: 4, value: 4, icon: "group", eng_text: "English", text: "English", langKey: "en"},
  {key: 6, value: 6, icon: "group", eng_text: "Spanish", text: "Español", langKey: "es"},
  {key: 5, value: 5, icon: "group", eng_text: "French", text: "Français"},
  {key: 8, value: 8, icon: "group", eng_text: "Italian", text: "Italiano"},
  {key: 7, value: 7, icon: "group", eng_text: "German", text: "Deutsch"},
  {divider: true},
  {header: true, text: "oldClient.sourceStream", description: "oldClient.sourceStreamDescription", icon: "crosshairs"},
  {key: "he", value: 15, icon: "crosshairs", eng_text: "Hebrew", text: "עברית"},
  {key: "ru", value: 23, icon: "crosshairs", eng_text: "Russian", text: "Русский"},
  {key: "en", value: 24, icon: "crosshairs", eng_text: "English", text: "English"},
  {key: "es", value: 26, icon: "crosshairs", eng_text: "Spanish", text: "Español"},
  {key: "fr", value: 25, icon: "crosshairs", eng_text: "French", text: "Français"},
  {key: "it", value: 28, icon: "crosshairs", eng_text: "Italian", text: "Italiano"},
  {key: "de", value: 27, icon: "crosshairs", eng_text: "German", text: "Deutsch"},
  {key: "tr", value: 42, icon: "crosshairs", eng_text: "Turkish", text: "Türkçe"},
  {key: "pt", value: 41, icon: "crosshairs", eng_text: "Portuguese", text: "Português"},
  {key: "bg", value: 43, icon: "crosshairs", eng_text: "Bulgarian", text: "Български"},
  {key: "ka", value: 44, icon: "crosshairs", eng_text: "Georgian", text: "ქართული"},
  {key: "ro", value: 45, icon: "crosshairs", eng_text: "Romanian", text: "Romanian"},
  {key: "hu", value: 46, icon: "crosshairs", eng_text: "Hungarian", text: "Magyar"},
  {key: "sv", value: 47, icon: "crosshairs", eng_text: "Swedish", text: "Svenska"},
  {key: "lt", value: 48, icon: "crosshairs", eng_text: "Lithuanian", text: "Lietuvių"},
  {key: "hr", value: 49, icon: "crosshairs", eng_text: "Croatian", text: "Hrvatski"},
  {key: "ja", value: 50, icon: "crosshairs", eng_text: "Japanese", text: "日本語"},
  {key: "sl", value: 51, icon: "crosshairs", eng_text: "Slovenian", text: "Slovenščina"},
  {key: "pl", value: 52, icon: "crosshairs", eng_text: "Polish", text: "Polski"},
  {key: "no", value: 53, icon: "crosshairs", eng_text: "Norwegian", text: "Norsk"},
  {key: "lv", value: 54, icon: "crosshairs", eng_text: "Latvian", text: "Latviešu"},
  {key: "ua", value: 55, icon: "crosshairs", eng_text: "Ukrainian", text: "Українська", langKey: "ru"},
  {key: "nl", value: 56, icon: "crosshairs", eng_text: "Dutch", text: "Nederlands"},
  {key: "cn", value: 57, icon: "crosshairs", eng_text: "Chinese", text: "中文"},
  {key: "et", value: 58, icon: "crosshairs", eng_text: "Amharic", text: "አማርኛ"},
  {key: "in", value: 59, icon: "crosshairs", eng_text: "Hindi", text: "हिन्दी"},
  {key: "ir", value: 60, icon: "crosshairs", eng_text: "Persian", text: "فارسی"},
  {key: "ar", value: 62, icon: "crosshairs", eng_text: "Arabic", text: "اَلْعَرَبِيَّةُ"},
  {key: "in", value: 63, icon: "crosshairs", eng_text: "Indonesian", text: "Bahasa Indonesia"},
  {key: "hy", value: 65, icon: "crosshairs", eng_text: "Armenian", text: "Հայերէն"},
  {key: "da", value: 66, icon: "crosshairs", eng_text: "Danish", text: "Dansk"},
  {key: "et", value: 67, icon: "crosshairs", eng_text: "Estonian", text: "eesti keel"},
  {key: "el", value: 68, icon: "crosshairs", eng_text: "Greek", text: "ελληνικά"},
  {key: "tl", value: 69, icon: "crosshairs", eng_text: "Tagalog", text: "ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔"},
  {key: "az", value: 70, icon: "crosshairs", eng_text: "Azerbaijani", text: "Азәрбајҹан дили"},
  {divider: true},
  {
    header: true,
    text: "oldClient.dualLnaguagesStream",
    description: "oldClient.dualLnaguagesStreamDescription",
    icon: "group",
  },
  {key: "heru", value: 10, icon: "group", eng_text: "Heb-Rus", text: "Русский-עברית", langKey: "ru"},
  {key: "heen", value: 17, icon: "group", eng_text: "Heb-Eng", text: "English-עברית", langKey: "en"},
];
export const audiog_options = [
  {key: 101, value: 101, text: "Workshop", disabled: true, icon: "tags", selected: true},
  {key: 1, value: 64, text: "Source"},
  {key: 2, value: 2, text: "Hebrew"},
  {key: 3, value: 3, text: "Russian"},
  {key: 4, value: 4, text: "English"},
  {key: 6, value: 6, text: "Spanish"},
  {key: 5, value: 5, text: "French"},
  {key: 8, value: 8, text: "Italian"},
  {key: 7, value: 7, text: "German"},
  {key: 100, value: 100, text: "Source", disabled: true, icon: "tags", selected: true},
  {key: "he", value: 15, text: "Hebrew"},
  {key: "ru", value: 23, text: "Russian"},
  {key: "en", value: 24, text: "English"},
  {key: "es", value: 26, text: "Spanish"},
  {key: "fr", value: 25, text: "French"},
  {key: "it", value: 28, text: "Italian"},
  {key: "de", value: 27, text: "German"},
  {key: "tr", value: 42, text: "Turkish"},
  {key: "pt", value: 41, text: "Portuguese"},
  {key: "bg", value: 43, text: "Bulgarian"},
  {key: "ka", value: 44, text: "Georgian"},
  {key: "ro", value: 45, text: "Romanian"},
  {key: "hu", value: 46, text: "Hungarian"},
  {key: "sv", value: 47, text: "Swedish"},
  {key: "lt", value: 48, text: "Lithuanian"},
  {key: "hr", value: 49, text: "Croatian"},
  {key: "ja", value: 50, text: "Japanese"},
  {key: "sl", value: 51, text: "Slovenian"},
  {key: "pl", value: 52, text: "Polish"},
  {key: "no", value: 53, text: "Norwegian"},
  {key: "lv", value: 54, text: "Latvian"},
  {key: "ua", value: 55, text: "Ukrainian"},
  {key: "nl", value: 56, text: "Dutch"},
  {key: "cn", value: 57, text: "Chinese"},
  {key: "et", value: 58, text: "Amharic"},
  {key: "in", value: 59, text: "Hindi"},
  {key: "ir", value: 60, text: "Persian"},
  {key: "ar", value: 62, text: "Arabic"},
  {key: "in", value: 63, text: "Indonesian"},
  {key: "hy", value: 65, text: "Armenian"},
  {key: "da", value: 66, text: "Danish"},
  {key: "et", value: 67, text: "Estonian"},
  {key: "el", value: 68, text: "Greek"},
  {key: "tl", value: 69, text: "Tagalog"},
  {key: "az", value: 70, text: "Azerbaijani"},
  {key: 99, value: 99, text: "Special", disabled: true, icon: "tags", selected: true},
  {key: "heru", value: 10, text: "Heb-Rus"},
  {key: "heen", value: 17, text: "Heb-Eng"},
];

export const gxycol = [0, 201, 203, 202, 204];

export const trllang = {
  Original: 201,
  Hebrew: 401,
  Russian: 402,
  English: 403,
  Spanish: 404,
  French: 405,
  Italian: 406,
  German: 407,
  Turkish: 408,
  Portuguese: 309,
  Bulgarian: 310,
  Georgian: 311,
  Romanian: 312,
  Hungarian: 313,
  Swedish: 314,
  Lithuanian: 315,
  Croatian: 316,
  Japanese: 317,
  Slovenian: 318,
  Polish: 319,
  Norwegian: 320,
  Latvian: 321,
  Ukrainian: 322,
  Dutch: 323,
  Chinese: 324,
  Amharic: 325,
  Hindi: 326,
  Persian: 327,
  Arabic: 328,
  Indonesian: 329,
  "Heb-Eng": 303,
  "Heb-Rus": 302,
};
export const LANGUAGES = [
  {code: "ab", name: "Abkhaz", nativeName: "аҧсуа"},
  {code: "aa", name: "Afar", nativeName: "Afaraf"},
  {code: "af", name: "Afrikaans", nativeName: "Afrikaans"},
  {code: "ak", name: "Akan", nativeName: "Akan"},
  {code: "sq", name: "Albanian", nativeName: "Shqip"},
  {code: "am", name: "Amharic", nativeName: "አማርኛ"},
  {code: "ar", name: "Arabic", nativeName: "العربية"},
  {code: "an", name: "Aragonese", nativeName: "Aragonés"},
  {code: "hy", name: "Armenian", nativeName: "Հայերեն"},
  {code: "as", name: "Assamese", nativeName: "অসমীয়া"},
  {code: "av", name: "Avaric", nativeName: "авар мацӀ, магӀарул мацӀ"},
  {code: "ae", name: "Avestan", nativeName: "avesta"},
  {code: "ay", name: "Aymara", nativeName: "aymar aru"},
  {code: "az", name: "Azerbaijani", nativeName: "azərbaycan dili"},
  {code: "bm", name: "Bambara", nativeName: "bamanankan"},
  {code: "ba", name: "Bashkir", nativeName: "башҡорт теле"},
  {code: "eu", name: "Basque", nativeName: "euskara, euskera"},
  {code: "be", name: "Belarusian", nativeName: "Беларуская"},
  {code: "bn", name: "Bengali", nativeName: "বাংলা"},
  {code: "bh", name: "Bihari", nativeName: "भोजपुरी"},
  {code: "bi", name: "Bislama", nativeName: "Bislama"},
  {code: "bs", name: "Bosnian", nativeName: "bosanski jezik"},
  {code: "br", name: "Breton", nativeName: "brezhoneg"},
  {code: "bg", name: "Bulgarian", nativeName: "български език"},
  {code: "my", name: "Burmese", nativeName: "ဗမာစာ"},
  {code: "ca", name: "Catalan; Valencian", nativeName: "Català"},
  {code: "ch", name: "Chamorro", nativeName: "Chamoru"},
  {code: "ce", name: "Chechen", nativeName: "нохчийн мотт"},
  {code: "ny", name: "Chichewa; Chewa; Nyanja", nativeName: "chiCheŵa, chinyanja"},
  {code: "zh", name: "Chinese", nativeName: "中文 (Zhōngwén), 汉语, 漢語"},
  {code: "cv", name: "Chuvash", nativeName: "чӑваш чӗлхи"},
  {code: "kw", name: "Cornish", nativeName: "Kernewek"},
  {code: "co", name: "Corsican", nativeName: "corsu, lingua corsa"},
  {code: "cr", name: "Cree", nativeName: "ᓀᐦᐃᔭᐍᐏᐣ"},
  {code: "hr", name: "Croatian", nativeName: "hrvatski"},
  {code: "cs", name: "Czech", nativeName: "česky, čeština"},
  {code: "da", name: "Danish", nativeName: "dansk"},
  {code: "dv", name: "Divehi; Dhivehi; Maldivian;", nativeName: "ދިވެހި"},
  {code: "nl", name: "Dutch", nativeName: "Nederlands, Vlaams"},
  {code: "en", name: "English", nativeName: "English"},
  {code: "eo", name: "Esperanto", nativeName: "Esperanto"},
  {code: "et", name: "Estonian", nativeName: "eesti, eesti keel"},
  {code: "ee", name: "Ewe", nativeName: "Eʋegbe"},
  {code: "fo", name: "Faroese", nativeName: "føroyskt"},
  {code: "fj", name: "Fijian", nativeName: "vosa Vakaviti"},
  {code: "fi", name: "Finnish", nativeName: "suomi, suomen kieli"},
  {code: "fr", name: "French", nativeName: "français, langue française"},
  {code: "ff", name: "Fula; Fulah; Pulaar; Pular", nativeName: "Fulfulde, Pulaar, Pular"},
  {code: "gl", name: "Galician", nativeName: "Galego"},
  {code: "ka", name: "Georgian", nativeName: "ქართული"},
  {code: "de", name: "German", nativeName: "Deutsch"},
  {code: "el", name: "Greek, Modern", nativeName: "Ελληνικά"},
  {code: "gn", name: "Guaraní", nativeName: "Avañeẽ"},
  {code: "gu", name: "Gujarati", nativeName: "ગુજરાતી"},
  {code: "ht", name: "Haitian; Haitian Creole", nativeName: "Kreyòl ayisyen"},
  {code: "ha", name: "Hausa", nativeName: "Hausa, هَوُسَ"},
  {code: "he", name: "Hebrew (modern)", nativeName: "עברית"},
  {code: "hz", name: "Herero", nativeName: "Otjiherero"},
  {code: "hi", name: "Hindi", nativeName: "हिन्दी, हिंदी"},
  {code: "ho", name: "Hiri Motu", nativeName: "Hiri Motu"},
  {code: "hu", name: "Hungarian", nativeName: "Magyar"},
  {code: "ia", name: "Interlingua", nativeName: "Interlingua"},
  {code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia"},
  {code: "ie", name: "Interlingue", nativeName: "Originally called Occidental; then Interlingue after WWII"},
  {code: "ga", name: "Irish", nativeName: "Gaeilge"},
  {code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo"},
  {code: "ik", name: "Inupiaq", nativeName: "Iñupiaq, Iñupiatun"},
  {code: "io", name: "Ido", nativeName: "Ido"},
  {code: "is", name: "Icelandic", nativeName: "Íslenska"},
  {code: "it", name: "Italian", nativeName: "Italiano"},
  {code: "iu", name: "Inuktitut", nativeName: "ᐃᓄᒃᑎᑐᑦ"},
  {code: "ja", name: "Japanese", nativeName: "日本語 (にほんご／にっぽんご)"},
  {code: "jv", name: "Javanese", nativeName: "basa Jawa"},
  {code: "kl", name: "Kalaallisut, Greenlandic", nativeName: "kalaallisut, kalaallit oqaasii"},
  {code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ"},
  {code: "kr", name: "Kanuri", nativeName: "Kanuri"},
  {code: "ks", name: "Kashmiri", nativeName: "कश्मीरी, كشميري‎"},
  {code: "kk", name: "Kazakh", nativeName: "Қазақ тілі"},
  {code: "km", name: "Khmer", nativeName: "ភាសាខ្មែរ"},
  {code: "ki", name: "Kikuyu, Gikuyu", nativeName: "Gĩkũyũ"},
  {code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda"},
  {code: "ky", name: "Kirghiz, Kyrgyz", nativeName: "кыргыз тили"},
  {code: "kv", name: "Komi", nativeName: "коми кыв"},
  {code: "kg", name: "Kongo", nativeName: "KiKongo"},
  {code: "ko", name: "Korean", nativeName: "한국어 (韓國語), 조선말 (朝鮮語)"},
  {code: "ku", name: "Kurdish", nativeName: "Kurdî, كوردی‎"},
  {code: "kj", name: "Kwanyama, Kuanyama", nativeName: "Kuanyama"},
  {code: "la", name: "Latin", nativeName: "latine, lingua latina"},
  {code: "lb", name: "Luxembourgish, Letzeburgesch", nativeName: "Lëtzebuergesch"},
  {code: "lg", name: "Luganda", nativeName: "Luganda"},
  {code: "li", name: "Limburgish, Limburgan, Limburger", nativeName: "Limburgs"},
  {code: "ln", name: "Lingala", nativeName: "Lingála"},
  {code: "lo", name: "Lao", nativeName: "ພາສາລາວ"},
  {code: "lt", name: "Lithuanian", nativeName: "lietuvių kalba"},
  {code: "lu", name: "Luba-Katanga", nativeName: ""},
  {code: "lv", name: "Latvian", nativeName: "latviešu valoda"},
  {code: "gv", name: "Manx", nativeName: "Gaelg, Gailck"},
  {code: "mk", name: "Macedonian", nativeName: "македонски јазик"},
  {code: "mg", name: "Malagasy", nativeName: "Malagasy fiteny"},
  {code: "ms", name: "Malay", nativeName: "bahasa Melayu, بهاس ملايو‎"},
  {code: "ml", name: "Malayalam", nativeName: "മലയാളം"},
  {code: "mt", name: "Maltese", nativeName: "Malti"},
  {code: "mi", name: "Māori", nativeName: "te reo Māori"},
  {code: "mr", name: "Marathi (Marāṭhī)", nativeName: "मराठी"},
  {code: "mh", name: "Marshallese", nativeName: "Kajin M̧ajeļ"},
  {code: "mn", name: "Mongolian", nativeName: "монгол"},
  {code: "na", name: "Nauru", nativeName: "Ekakairũ Naoero"},
  {code: "nv", name: "Navajo, Navaho", nativeName: "Diné bizaad, Dinékʼehǰí"},
  {code: "nb", name: "Norwegian Bokmål", nativeName: "Norsk bokmål"},
  {code: "nd", name: "North Ndebele", nativeName: "isiNdebele"},
  {code: "ne", name: "Nepali", nativeName: "नेपाली"},
  {code: "ng", name: "Ndonga", nativeName: "Owambo"},
  {code: "nn", name: "Norwegian Nynorsk", nativeName: "Norsk nynorsk"},
  {code: "no", name: "Norwegian", nativeName: "Norsk"},
  {code: "ii", name: "Nuosu", nativeName: "ꆈꌠ꒿ Nuosuhxop"},
  {code: "nr", name: "South Ndebele", nativeName: "isiNdebele"},
  {code: "oc", name: "Occitan", nativeName: "Occitan"},
  {code: "oj", name: "Ojibwe, Ojibwa", nativeName: "ᐊᓂᔑᓈᐯᒧᐎᓐ"},
  {
    code: "cu",
    name: "Old Church Slavonic, Church Slavic, Church Slavonic, Old Bulgarian, Old Slavonic",
    nativeName: "ѩзыкъ словѣньскъ",
  },
  {code: "om", name: "Oromo", nativeName: "Afaan Oromoo"},
  {code: "or", name: "Oriya", nativeName: "ଓଡ଼ିଆ"},
  {code: "os", name: "Ossetian, Ossetic", nativeName: "ирон æвзаг"},
  {code: "pa", name: "Panjabi, Punjabi", nativeName: "ਪੰਜਾਬੀ, پنجابی‎"},
  {code: "pi", name: "Pāli", nativeName: "पाऴि"},
  {code: "fa", name: "Persian", nativeName: "فارسی"},
  {code: "pl", name: "Polish", nativeName: "polski"},
  {code: "ps", name: "Pashto, Pushto", nativeName: "پښتو"},
  {code: "pt", name: "Portuguese", nativeName: "Português"},
  {code: "qu", name: "Quechua", nativeName: "Runa Simi, Kichwa"},
  {code: "rm", name: "Romansh", nativeName: "rumantsch grischun"},
  {code: "rn", name: "Kirundi", nativeName: "kiRundi"},
  {code: "ro", name: "Romanian, Moldavian, Moldovan", nativeName: "română"},
  {code: "ru", name: "Russian", nativeName: "русский язык"},
  {code: "sa", name: "Sanskrit (Saṁskṛta)", nativeName: "संस्कृतम्"},
  {code: "sc", name: "Sardinian", nativeName: "sardu"},
  {code: "sd", name: "Sindhi", nativeName: "सिन्धी, سنڌي، سندھی‎"},
  {code: "se", name: "Northern Sami", nativeName: "Davvisámegiella"},
  {code: "sm", name: "Samoan", nativeName: "gagana faa Samoa"},
  {code: "sg", name: "Sango", nativeName: "yângâ tî sängö"},
  {code: "sr", name: "Serbian", nativeName: "српски језик"},
  {code: "gd", name: "Scottish Gaelic; Gaelic", nativeName: "Gàidhlig"},
  {code: "sn", name: "Shona", nativeName: "chiShona"},
  {code: "si", name: "Sinhala, Sinhalese", nativeName: "සිංහල"},
  {code: "sk", name: "Slovak", nativeName: "slovenčina"},
  {code: "sl", name: "Slovene", nativeName: "slovenščina"},
  {code: "so", name: "Somali", nativeName: "Soomaaliga, af Soomaali"},
  {code: "st", name: "Southern Sotho", nativeName: "Sesotho"},
  {code: "es", name: "Spanish; Castilian", nativeName: "español, castellano"},
  {code: "su", name: "Sundanese", nativeName: "Basa Sunda"},
  {code: "sw", name: "Swahili", nativeName: "Kiswahili"},
  {code: "ss", name: "Swati", nativeName: "SiSwati"},
  {code: "sv", name: "Swedish", nativeName: "svenska"},
  {code: "ta", name: "Tamil", nativeName: "தமிழ்"},
  {code: "te", name: "Telugu", nativeName: "తెలుగు"},
  {code: "tg", name: "Tajik", nativeName: "тоҷикӣ, toğikī, تاجیکی‎"},
  {code: "th", name: "Thai", nativeName: "ไทย"},
  {code: "ti", name: "Tigrinya", nativeName: "ትግርኛ"},
  {code: "bo", name: "Tibetan Standard, Tibetan, Central", nativeName: "བོད་ཡིག"},
  {code: "tk", name: "Turkmen", nativeName: "Türkmen, Түркмен"},
  {code: "tl", name: "Tagalog", nativeName: "Wikang Tagalog, ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔"},
  {code: "tn", name: "Tswana", nativeName: "Setswana"},
  {code: "to", name: "Tonga (Tonga Islands)", nativeName: "faka Tonga"},
  {code: "tr", name: "Turkish", nativeName: "Türkçe"},
  {code: "ts", name: "Tsonga", nativeName: "Xitsonga"},
  {code: "tt", name: "Tatar", nativeName: "татарча, tatarça, تاتارچا‎"},
  {code: "tw", name: "Twi", nativeName: "Twi"},
  {code: "ty", name: "Tahitian", nativeName: "Reo Tahiti"},
  {code: "ug", name: "Uighur, Uyghur", nativeName: "Uyƣurqə, ئۇيغۇرچە‎"},
  {code: "uk", name: "Ukrainian", nativeName: "українська"},
  {code: "ur", name: "Urdu", nativeName: "اردو"},
  {code: "uz", name: "Uzbek", nativeName: "zbek, Ўзбек, أۇزبېك‎"},
  {code: "ve", name: "Venda", nativeName: "Tshivenḓa"},
  {code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt"},
  {code: "vo", name: "Volapük", nativeName: "Volapük"},
  {code: "wa", name: "Walloon", nativeName: "Walon"},
  {code: "cy", name: "Welsh", nativeName: "Cymraeg"},
  {code: "wo", name: "Wolof", nativeName: "Wollof"},
  {code: "fy", name: "Western Frisian", nativeName: "Frysk"},
  {code: "xh", name: "Xhosa", nativeName: "isiXhosa"},
  {code: "yi", name: "Yiddish", nativeName: "ייִדיש"},
  {code: "yo", name: "Yoruba", nativeName: "Yorùbá"},
  {code: "za", name: "Zhuang, Chuang", nativeName: "Saɯ cueŋƅ, Saw cuengh"},
];

export const LANG_MAP = {
  Spanish: "es",
  English: "en",
  Hebrew: "he",
  Russian: "ru"
}

export const sketchesByLang = {he: "Hebrew", ru: "Russian", es: "Spanish", en: "English"};

export const mqtt_sys = {
  "$SYS/broker/clients/connected": {name: "clcon", value: 0},
  "$SYS/broker/messages/received": {name: "mresv", value: 0},
  "$SYS/broker/messages/sent": {name: "msent", value: 0},
  "$SYS/broker/bytes/received": {name: "brecv", value: 0},
  "$SYS/broker/bytes/sent": {name: "bsent", value: 0},
  "$SYS/broker/subscriptions/count": {name: "subnm", value: 0},
  "$SYS/broker/publish/messages/dropped": {name: "mdrop", value: 0},
  "$SYS/broker/clients/maximum": {name: "clmax", value: 0},
};

export const short_regions = {
  europe: "EU",
  asia: "AS",
  africa: "AF",
  "latin-america": "LA",
  russia: "RU",
  ukraine: "UA",
  "north-america": "NA",
  israel: "IL",
  "petach-tikva": "PT",
};

export const region_filter = {
  europe: false,
  asia: false,
  africa: false,
  "latin-america": false,
  russia: false,
  ukraine: false,
  "north-america": false,
  israel: false,
  "petach-tikva": false,
};

export const media_object = {
  audio: {
    context: null,
    device: null,
    devices: [],
    error: null,
    stream: null,
  },
  video: {
    setting: {width: 320, height: 180, ideal: 15},
    device: null,
    devices: [],
    error: null,
    stream: null,
  },
};

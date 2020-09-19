export const ENV = process.env.NODE_ENV;

export const BASE_URL = ENV === 'production' ?
    process.env.REACT_APP_GXY_URL :
    `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/`;

export const SENTRY_KEY = process.env.REACT_APP_SENTRY_KEY;

export const GEO_IP_INFO = process.env.REACT_APP_GEO_IP_INFO;
export const STUN_SRV_GXY = process.env.REACT_APP_STUN_SRV_GXY;
export const SECRET = process.env.REACT_APP_SECRET;

export const WKLI_ENTER = process.env.REACT_APP_WKLI_ENTER;
export const WKLI_LEAVE = process.env.REACT_APP_WKLI_LEAVE;
export const RESET_VOTE = process.env.REACT_APP_RESET_VOTE;

export const API_BACKEND = process.env.REACT_APP_API_BACKEND;
export const API_BACKEND_USERNAME = process.env.REACT_APP_API_BACKEND_USERNAME;
export const API_BACKEND_PASSWORD = process.env.REACT_APP_API_BACKEND_PASSWORD;

export const MONITORING_BACKEND = process.env.REACT_APP_MONITORING_BACKEND;
export const AUTH_API_BACKEND = process.env.REACT_APP_AUTH_API_BACKEND;

export const ADMIN_SRV_STR1 = process.env.REACT_APP_ADMIN_SRV_STR1;
export const ADMIN_SRV_STR2 = process.env.REACT_APP_ADMIN_SRV_STR2;
export const ADMIN_SRV_STR3 = process.env.REACT_APP_ADMIN_SRV_STR3;
export const ADMIN_SRV_STR4 = process.env.REACT_APP_ADMIN_SRV_STR4;
export const ADMIN_SRV_STR5 = process.env.REACT_APP_ADMIN_SRV_STR5;
export const ADMIN_SRV_STR6 = process.env.REACT_APP_ADMIN_SRV_STR6;
export const ADMIN_SRV_STR7 = process.env.REACT_APP_ADMIN_SRV_STR7;

export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
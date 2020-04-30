export const ENV = process.env.NODE_ENV;

export const BASE_URL = ENV === 'production' ?
    process.env.REACT_APP_GXY_URL :
    `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/`;

export const SENTRY_KEY = process.env.REACT_APP_SENTRY_KEY;

export const GEO_IP_INFO = process.env.REACT_APP_GEO_IP_INFO;
export const WFRP_STATE = process.env.REACT_APP_WFRP_STATE;
export const WFDB_STATE = process.env.REACT_APP_WFDB_STATE;
export const STUN_SRV_STR = process.env.REACT_APP_STUN_SRV_STR;
export const STUN_SRV_GXY = process.env.REACT_APP_STUN_SRV_GXY;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;
export const JANUS_SRV_GXY1 = process.env.REACT_APP_JANUS_SRV_GXY1;
export const JANUS_SRV_GXY2 = process.env.REACT_APP_JANUS_SRV_GXY2;
export const JANUS_SRV_GXY3 = process.env.REACT_APP_JANUS_SRV_GXY3;
export const JANUS_ADMIN_GXY1 = process.env.REACT_APP_ADMIN_SRV_GXY1;
export const JANUS_ADMIN_GXY2 = process.env.REACT_APP_ADMIN_SRV_GXY2;
export const JANUS_ADMIN_GXY3 = process.env.REACT_APP_ADMIN_SRV_GXY3;
export const JANUS_SRV_STR3 = process.env.REACT_APP_JANUS_SRV_STR3;
export const JANUS_SRV_STR4 = process.env.REACT_APP_JANUS_SRV_STR4;
export const JANUS_STR_HOST_PL = process.env.REACT_APP_JANUS_HOST_PL;
export const JANUS_STR_HOST_GR = process.env.REACT_APP_JANUS_HOST_GR;
export const JANUS_STR_HOST_UK = process.env.REACT_APP_JANUS_HOST_UK;

export const API_BACKEND = process.env.REACT_APP_API_BACKEND;
export const MONITORING_BACKEND = process.env.REACT_APP_MONITORING_BACKEND;


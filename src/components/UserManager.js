import Keycloak from "keycloak-js";
import api from "../shared/Api";
import {AUTH_URL} from "../shared/env";

const logging = new URLSearchParams(window.location.search).has('loglevel');

const userManagerConfig = {
  url: `${AUTH_URL}`,
  realm: "main",
  clientId: "galaxy",
};

const initOptions = {
  onLoad: "check-sso",
  checkLoginIframe: false,
  flow: "standard",
  pkceMethod: "S256",
  enableLogging: logging,
};

export const kc = new Keycloak(userManagerConfig);

kc.onTokenExpired = () => {
  renewToken(0);
};

kc.onAuthLogout = () => {
  api.setAccessToken(null);
  kc.logout();
};

const renewToken = (retry) => {
  retry++;
  kc.updateToken(5)
    .then(refreshed => {
      if (refreshed) {
        api.setAccessToken(kc.token);
      }
    })
    .catch(() => {
      if (retry > 10) {
        kc.clearToken();
      } else {
        setTimeout(() => {
          renewToken(retry);
        }, 10000);
      }
    });
};

const setData = () => {
  const {realm_access: {roles}, sub, given_name, name, email, family_name} = kc.tokenParsed;
  const user = {display: name, email, roles, id: sub, username: given_name, familyname: family_name};
  api.setAccessToken(kc.token);
  return user;
};

export const getUser = (callback) => {
  kc.init(initOptions)
    .then(authenticated => {
      const user = authenticated ? setData() : null;
      callback(user);
    })
    .catch(err => console.error(err));
};

export default kc;

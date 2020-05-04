import { Log as oidclog, UserManager } from 'oidc-client';
import {KJUR} from 'jsrsasign';
import {reportToSentry} from "../shared/tools";

const AUTH_URL = 'https://accounts.kbb1.com/auth/realms/main';
export const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_GXY_URL : 'http://localhost:3000/';

oidclog.logger = console;
oidclog.level  = 0;
let user_mgr = null;

const userManagerConfig = {
    authority: AUTH_URL,
    client_id: 'galaxy',
    redirect_uri: `${BASE_URL}`,
    response_type: 'token id_token',
    scope: 'profile',
    post_logout_redirect_uri: `${BASE_URL}`,
    automaticSilentRenew: true,
    silent_redirect_uri: `${BASE_URL}/silent_renew.html`,
    filterProtocolClaims: true,
    loadUserInfo: true,
};

export const client = new UserManager(userManagerConfig);

client.events.addAccessTokenExpiring(() => {
    console.log("...RENEW TOKEN...");
});

client.events.addAccessTokenExpired((data) => {
    console.log("...!TOKEN EXPIRED!...");
    reportToSentry("TOKEN EXPIRED: " + data,{source: "login"}, user_mgr, "warning");
    //client.signoutRedirect();
});

client.events.addUserSignedOut(() => {
    console.log("...LOGOUT EVENT...");
    //client.signoutRedirect();
});

client.events.addSilentRenewError((error) =>{
    console.error("Silent Renew Error: " + error);
    reportToSentry("Silent Renew Error: " + error,{source: "login"}, user_mgr, "warning");
});

export const getUser = (cb) =>
    client.getUser().then((user) => {
        console.log('getUser', user);
        if(user) {
            let at = KJUR.jws.JWS.parse(user.access_token);
            console.log('AT', at);
            const {
              realm_access: {roles},
              request,
              timestamp: request_timestamp,
              pending,
            } = at.payloadObj;
            const {
              email,
              given_name,
              group,
              name,
              sub,
              title,
            } = user.profile;
            user = {
              access_token: user.access_token,
              email,
              group,
              id: sub,
              name,
              pending,
              request,
              request_timestamp,
              roles,
              title: title || given_name,
              username: given_name,
            };
            user_mgr = user;
        }
        cb(user);
    }).catch((error) => {
      console.log("Error: ",error);
      reportToSentry("Get User Error: " + error, {source: "login"}, null, "warning");
    });

export default client;

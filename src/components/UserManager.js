import { Log as oidclog, UserManager } from 'oidc-client';
import {KJUR} from 'jsrsasign';
import * as Sentry from "@sentry/browser";

const AUTH_URL = 'https://accounts.kbb1.com/auth/realms/main';
export const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.REACT_APP_GXY_URL : 'http://localhost:3000/';

oidclog.logger = console;
oidclog.level  = 0;

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
    Sentry.captureException("TOKEN EXPIRED: " + data)
    //client.signoutRedirect();
});

client.events.addUserSignedOut(() => {
    console.log("...LOGOUT EVENT...");
    //client.signoutRedirect();
});

client.events.addSilentRenewError((error) =>{
    console.error("Silent Renew Error: " + error);
    Sentry.captureException("Silent Renew Error: " + error)
});

export const getUser = (cb) =>
    client.getUser().then((user) => {
        if(user) {
            let at = KJUR.jws.JWS.parse(user.access_token);
            let roles = at.payloadObj.realm_access.roles;
            const {sub,given_name,name,email,group,title} = user.profile;
            user = {id: sub, username: given_name, name, title: title || given_name, group, email, roles}
        }
        cb(user)
    })
        .catch((error) => {
            console.log("Error: ",error);
            Sentry.captureException("Get User Error: " + error)
        });

export const userLogin = (url) => {
    getUser(cb => {
        if(!cb) {
            client.signinRedirect({state: url});
        } else {
            window.location = url;
        }
    });
};

export default client;

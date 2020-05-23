import Keycloak from 'keycloak-js';
import api from '../shared/Api';

const userManagerConfig = {
    url: 'https://accounts.kbb1.com/auth',
    realm: 'main',
    clientId: 'galaxy',
    scope: 'profile',
    enableLogging: true,
};

export const kc = new Keycloak(userManagerConfig);

kc.onTokenExpired = () => {
    let retry = 0;
    let chk = setInterval(() => {
        retry++;
        if(retry < 5) {
            console.debug("Refresh retry: " + retry);
            renewToken(token => {
                if(token) {
                    console.debug("-- Refreshed --");
                    clearInterval(chk);
                    api.setAccessToken(token);
                }
            })
        }
        if(retry >= 5) {
            console.error("Refresh retry: " + retry + " - failed");
            clearInterval(chk);
            kc.clearToken();
        }
    }, 5000);
};

kc.onAuthLogout = () => {
    console.error("-- Detect clearToken --");
    api.setAccessToken(null);
    kc.logout();
}

const renewToken = (callback) => {
    kc.updateToken(70)
        .then(refreshed => {
            if(refreshed) {
                callback(kc.token)
            } else {
                console.warn('Token is still valid?..');
            }
        })
        .catch(err => {
            console.error("Refresh token failed");
            callback(null)
        });
}

export const getUser = (callback) => {
    kc.init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
        flow: 'standard',
        pkceMethod: 'S256',
    }).then(authenticated => {
        if(authenticated) {
            kc.loadUserProfile()
                .then(profile => {
                    const {realm_access: {roles},sub,given_name,name,email} = kc.tokenParsed;
                    const {pending, request, timestamp: request_timestamp,group,title} = profile.attributes;
                    const user = {
                        id: sub, title: title ? title[0] : given_name, username: given_name,
                        email, group: group ? group[0] : undefined, name, pending, request, request_timestamp, roles,
                    };
                    api.setAccessToken(kc.token);
                    callback(user)
                })
        } else {
            callback(null)
        }
    }).catch((err) => console.log(err));
};

export default kc;
